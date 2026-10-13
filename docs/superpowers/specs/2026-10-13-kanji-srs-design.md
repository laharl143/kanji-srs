# Kanji SRS App: Design Spec

**Date:** 2026-10-13
**Status:** Approved design, ready for implementation plan
**Builder:** IBM Bob (planning done in Claude Code)

## 1. Goal

A private, local web app for learning Japanese kanji up to **JLPT N3** using a spaced repetition system (SRS), in the style of radical → kanji → vocabulary courses. It is built **entirely from free, openly licensed data** plus **original** AI-written mnemonics.

### Non-negotiable rules

1. **No WaniKani content.** Do not scrape, copy, paraphrase, or import WaniKani's (or any paid course's) mnemonics, radical names, example sentences, audio, or level lists. Do not use its API.
2. **No WaniKani branding.** Do not use the name, logo, colors, or a copy of its UI. SRS stage names are this app's own (see §6).
3. **Original mnemonics only.** Radical names and every mnemonic are invented from scratch.
4. **Credit the open data sources** on a Credits page.

### Success criteria

- `npm run dev` on Windows opens a working app at `http://localhost:3000` with no external services.
- You can do lessons and reviews from level 1 through at least level 3 on the first content release, and through the final level once all mnemonics are written.
- All ~650 N5 to N3 kanji, their components, and the matching vocabulary are placed in levels with no item appearing before its parts.
- The SRS logic and the content validator have passing unit tests. One end-to-end test passes.
- Switching to a hosted database later needs only a new `DATABASE_URL` (plus adding login).

### Out of scope (for now)

Phone access and hosting, login and accounts, kana-only vocabulary, example sentences, stroke order animation, VOICEVOX audio (optional final phase), JLPT N2 and N1.

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript, React |
| Styling | Tailwind CSS |
| Database | libSQL (SQLite compatible) via `@libsql/client`, local file `file:./data/app.db` |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| Kana input | `wanakana` |
| Unit tests | Vitest |
| End to end tests | Playwright |
| Pipeline scripts | TypeScript run with `tsx` |
| Audio (v1) | Browser `speechSynthesis` with a `ja-JP` voice |

Use current stable versions at build time. Node 22 LTS or newer.

## 3. Architecture

### Folder layout

```
pipeline/
  raw/                 downloaded source files (gitignored)
  work/                mnemonic batches in progress (gitignored except README)
  src/                 pipeline scripts (download, build, batch, merge, validate)
content/
  subjects.json        generated: every radical, kanji, vocab with level + links
  mnemonics/
    radicals.json      original radical names + mnemonics, keyed by component character
    kanji.json         keyed by kanji character
    vocab.json         keyed by vocab written form
  content-version.txt  hash/version of the current content build
public/audio/          optional, generated later (gitignored)
src/
  lib/srs/             pure SRS logic, no DB or framework imports
  lib/answer/          answer checking (pure)
  lib/db/              Drizzle schema, client, queries
  lib/content/         loads content JSON into the DB (seed)
  app/                 Next.js routes and UI
tests/e2e/             Playwright tests
data/                  local SQLite file (gitignored)
docs/                  spec, plan
```

### Boundaries

- `src/lib/srs` and `src/lib/answer` are **pure functions**. They take plain objects and the current time (`now: Date`) as arguments and never read the clock, DB, or environment. This is what makes them testable and keeps the scheduling rules in one place.
- `src/lib/db` is the only code that talks to the database.
- Route handlers / server actions glue the two: load rows → call pure functions → write results.
- Content is **read only** at runtime. User progress never writes to content tables.

### Single user now, multi user later

Every progress table has `user_id TEXT NOT NULL`. For now, the app uses a constant `LOCAL_USER_ID = "local"`, read from one helper `getCurrentUserId()`. Adding auth later means changing that helper only.

## 4. Data model

### Content tables (rebuilt from `content/` by the seed script)

**subjects**

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | stable: assigned in `subjects.json`, never reused |
| type | TEXT | `radical` \| `kanji` \| `vocab` |
| characters | TEXT | the radical/kanji/word |
| level | INTEGER | 1 to N |
| position | INTEGER | order within level and type |
| meanings | JSON | `[{ "text": "...", "primary": true }]` |
| readings | JSON | kanji: `[{ "text": "...", "kind": "onyomi" \| "kunyomi", "primary": bool }]`; vocab: `[{ "text": "...", "primary": bool }]`; radicals: `[]` |
| component_ids | JSON | kanji → radical ids; vocab → kanji ids; radical → `[]` |
| meaning_mnemonic | TEXT | |
| reading_mnemonic | TEXT | null for radicals |
| jlpt | INTEGER | 5, 4, or 3 (null for radicals) |
| frequency | INTEGER | KANJIDIC2 frequency rank, nullable |

Derived lookups ("used in") are computed by query from `component_ids`.

### Progress tables

**assignments** (one row per user per subject, created when the subject unlocks)

| Column | Type | Notes |
|---|---|---|
| user_id | TEXT | PK part |
| subject_id | INTEGER | PK part |
| srs_stage | INTEGER | 0 = unlocked, lesson not done; 1 to 9 as §6 |
| unlocked_at | INTEGER | unix ms |
| started_at | INTEGER | lesson finished, nullable |
| available_at | INTEGER | next review due, nullable |
| passed_at | INTEGER | first reached stage 5, nullable |
| burned_at | INTEGER | reached stage 9, nullable |

**reviews** (append only log)

`id, user_id, subject_id, created_at, starting_stage, ending_stage, incorrect_meaning_count, incorrect_reading_count`

**user_notes**: `user_id, subject_id, meaning_note, reading_note, synonyms (JSON string array)`

**user_settings**: `user_id PK, current_level INTEGER DEFAULT 1, lesson_batch_size INTEGER DEFAULT 5, created_at`

## 5. Content pipeline

All scripts live in `pipeline/src/` and run via `npm run pipeline:<step>`.

### 5.1 Sources

| Data | Source | License | Use |
|---|---|---|---|
| Kanji meanings, readings, frequency | KANJIDIC2 (EDRDG) | CC BY-SA 4.0 | kanji fields |
| Vocabulary meanings, readings | JMdict English (EDRDG) | CC BY-SA 4.0 | vocab fields |
| Kanji → components | KRADFILE / kradfile-u (EDRDG) | CC BY-SA 4.0 | radical links |
| Which kanji and words are N5 to N3 | Jonathan Waller's JLPT lists (tanos.co.uk) | Check before use (believed Creative Commons BY) | item selection |

The `download` script records each file's URL, date, and SHA-256 in `pipeline/raw/SOURCES.json`. **Before using the tanos lists, confirm their license on the site and record it in `SOURCES.json`.** If they are not usable, fall back to the pre-2010 JLPT levels in KANJIDIC2 (`<jlpt>` 4 and 3 → treat old 4+3 as N5+N4, plus old 2 kanji ranked by frequency until ~650 kanji total) and report the change.

### 5.2 Selection

- **Kanji:** union of the N5, N4, N3 kanji lists (~650).
- **Vocabulary:** N5 to N3 vocab entries whose written form contains at least one kanji and whose kanji are *all* in the selected kanji set. Meanings and readings come from the matching JMdict entry (match on written form + reading). Keep up to 3 meanings. Words with no JMdict match are dropped and listed in the build report.
- **Radicals:** every KRADFILE component used by a selected kanji. If a component is itself a selected kanji, it still gets a radical entry (the radical teaches the shape, the kanji teaches the meaning and reading). Components with no Unicode rendering in common fonts are listed in the report for manual review.

### 5.3 Level building

1. Order kanji by JLPT (N5, then N4, then N3), then by KANJIDIC2 frequency (most common first; missing frequency goes last).
2. Pack kanji into levels of **25** in that order (last level may be smaller). Expected ~26 levels.
3. **Radical placement:** each radical goes in the level of the first kanji that uses it.
4. **Vocab placement:** each word goes in the level of its latest-introduced kanji.
5. **Position:** within a level, radicals then kanji then vocab, each in the order above.
6. IDs: assign once and persist. A rebuild keeps existing IDs for existing items (match on `type + characters`) and appends new IDs for new items. Never renumber.

Output: `content/subjects.json` (array of subject objects matching §4, without mnemonics) and a printed build report (counts per level, dropped items, warnings).

### 5.4 Mnemonics (written by Bob)

Mnemonics are stored separately in `content/mnemonics/*.json` so rebuilding levels never erases them.

- `npm run pipeline:batch -- --levels 1-3` writes files like `pipeline/work/batch-001.json` with up to 25 items that have no mnemonic yet. Each item includes the data needed to write a mnemonic (characters, meanings, readings, and for kanji the radical names it uses).
- Bob fills in each item's fields in place.
- `npm run pipeline:merge` validates each filled batch and merges it into `content/mnemonics/*.json`.

**Order matters:** write radical names for a level before that level's kanji mnemonics, because kanji mnemonics must use the radical names.

**Writing rules**

| Item | Fields | Rules |
|---|---|---|
| Radical | `name`, `meaning_mnemonic` | `name`: 1 to 3 English words, original, memorable, unique across all radicals. Mnemonic: 1 to 3 sentences tying the shape to the name. |
| Kanji | `meaning_mnemonic`, `reading_mnemonic` | Meaning: a short vivid story that names **every** component radical by its radical name and ends at the kanji's primary meaning. Reading: links the primary reading to a recurring English "sound hook" word for that reading (keep a shared list in `content/mnemonics/sound-hooks.json` so the same reading always uses the same hook). 2 to 4 sentences each. |
| Vocab | `reading_mnemonic` (meaning mnemonic optional) | 1 to 2 sentences explaining how the meaning follows from the kanji and which kanji reading is used (note rendaku or irregular readings). |

All text: plain English, no copied material from any course, book, or website. Use each kanji's own primary meaning from KANJIDIC2.

The radical `name` becomes the radical subject's primary meaning.

### 5.5 Validation (`npm run pipeline:validate`, also run by `merge` and in CI tests)

Fails if any of these hold:
- A kanji's radical is in a later level than the kanji.
- A vocab's kanji is in a later level than the vocab.
- A kanji or vocab has no meaning, or a kanji/vocab has no reading.
- A subject in an "enabled" level has no mnemonic (enabled levels are listed in `content/enabled-levels.json`, so content can ship in waves).
- A kanji meaning mnemonic does not contain the name of every one of its radicals (case insensitive).
- Two radicals share a name.
- Duplicate IDs, or an ID changed for an existing item.

### 5.6 Seeding

`npm run db:seed` replaces all rows in `subjects` from `content/subjects.json` + `content/mnemonics/*.json`, only for levels in `enabled-levels.json`. It never touches progress tables. On first run, it creates the local user's settings and unlocks level 1 (see §6.4).

## 6. SRS rules

### 6.1 Stages (all in `src/lib/srs/config.ts`)

| Stage | Name | Interval to next review |
|---|---|---|
| 0 | Lesson queue (unlocked, lesson not done) | n/a |
| 1 | Seed 1 | 4 hours |
| 2 | Seed 2 | 8 hours |
| 3 | Seed 3 | 1 day |
| 4 | Seed 4 | 2 days |
| 5 | Sprout 1 | 1 week |
| 6 | Sprout 2 | 2 weeks |
| 7 | Bloom | 1 month (30 days) |
| 8 | Harvest | 4 months (120 days) |
| 9 | Retired | none |

"Passed" means stage ≥ 5.

`available_at` = `now + interval`, **rounded down to the start of the hour**.

### 6.2 Lessons

Finishing a lesson (learn + quiz once correct) moves an assignment from stage 0 to stage 1 and sets `started_at` and `available_at`. Lessons are shown in `position` order within the lowest level first, radicals → kanji → vocab.

### 6.3 Reviews

- A review item has one or two questions: **meaning** for all types; **reading** for kanji and vocab.
- Questions from all due items are shuffled together. An item is complete when all its questions have been answered correctly once (wrong answers re-queue that question).
- On completion, with `wrong = incorrect_meaning_count + incorrect_reading_count`:
  - `wrong == 0` → `new_stage = stage + 1` (max 9).
  - `wrong > 0` → `penalty = stage >= 5 ? 2 : 1`; `new_stage = max(1, stage - ceil(wrong / 2) * penalty)`.
- Write a `reviews` row and update the assignment (`available_at`, plus `passed_at` the first time stage reaches 5 and `burned_at` at stage 9).
- **Wrap up:** stop pulling new items; finish items already started.

### 6.4 Unlocking and level up

- At start: create assignments (stage 0) for all level 1 radicals, and level 1 kanji with no radicals.
- After each review, run `computeUnlocks`:
  - A kanji at or below the user's current level unlocks when **all** its radicals are passed.
  - A vocab at or below the current level unlocks when **all** its kanji are passed.
- **Level up:** when ≥ 90% of the current level's kanji are passed, `current_level += 1`, and the new level's radicals unlock (plus any kanji whose radicals are already all passed).
- **Skip ahead (Settings):** setting level N marks every subject below level N as stage 9 (Retired) without reviews, then unlocks level N as at start. Confirm with a dialog.

## 7. Answer checking (`src/lib/answer`)

- **Reading input:** a text field bound with `wanakana.bind` so typed romaji becomes hiragana. Compare to accepted readings after normalizing katakana → hiragana.
- **Kanji reading kind:** each kanji question accepts its primary readings. If the answer matches a reading of the *other* kind (e.g. kun'yomi when on'yomi is primary), return `wrong_kind` → UI shakes with "Looking for the on'yomi" and the answer does not count as wrong.
- **Meaning input:** lowercase, trim, collapse spaces, strip punctuation. Accept exact matches of meanings plus user synonyms. Accept typos when Levenshtein distance ≤ `0` for length ≤ 3, `1` for length 4 to 5, `2` for length 6 to 9, `floor(len / 4)` for longer. Return `close` (accepted, shown as "close enough").
- Results: `correct` | `close` | `wrong` | `wrong_kind` | `invalid` (e.g. romaji left in reading field, which should shake, not count).

## 8. Screens

| Route | Content |
|---|---|
| `/` Dashboard | Lessons available count + Start button; reviews due now + Start button; next-24-hours review forecast by hour; current level progress (radicals and kanji passed / total, 90% marker); counts by stage group (Seed, Sprout, Bloom, Harvest, Retired). |
| `/lessons` | Batch of `lesson_batch_size`. For each item: characters, meanings, readings, components, mnemonics, play audio (vocab). Then a quiz over the batch using the review question flow; passing the quiz finishes the lessons. |
| `/reviews` | One question at a time. Header shows remaining count and accuracy. Feedback after each answer; expand item details after a wrong answer. Wrap up button. Summary at the end (correct, incorrect, stage changes). |
| `/subjects/[id]` | Full item details, used-in list, your meaning/reading notes and synonyms (editable), SRS stage and next review time. |
| `/levels` and `/levels/[n]` | Grid of every item in a level, colored by stage. |
| `/settings` | Lesson batch size, skip ahead to level, reset all progress (confirm dialog). |
| `/credits` | Data sources and licenses from §5.1. |

UI rules: mobile-friendly layout from the start (works at 375px wide); type colors distinguish radical / kanji / vocab; Japanese text uses a Japanese font stack (`"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif`); keyboard friendly reviews (Enter to submit, Enter again to continue).

## 9. Error handling

- Seed refuses to run if validation fails, and prints the failing checks.
- If the DB has progress for subject IDs that no longer exist in content, the seed logs and skips them (never deletes progress).
- Server actions validate input (e.g. subject IDs belong to the user's due items) and return a typed error; the UI shows a toast and keeps the current question.
- Speech synthesis unavailable → hide the audio button.

## 10. Testing

- **Vitest, `src/lib/srs`:** stage up, stage down with each penalty case, floor at 1, hour rounding, passed and burned timestamps, unlock rules, level up at exactly 90%, skip ahead.
- **Vitest, `src/lib/answer`:** romaji leftovers, katakana normalization, wrong kind, typo thresholds at each boundary, synonyms.
- **Vitest, pipeline:** level builder on a small fixture (ordering, radical and vocab placement, stable IDs on rebuild) and each validator rule.
- **Playwright:** fresh DB → do level 1 lesson batch → fake clock +4h → review those items correctly → stages are 2. Use a test-only env var to inject `now`.
- `npm test` runs Vitest; `npm run test:e2e` runs Playwright.

## 11. Build phases

1. Project setup, Drizzle schema, migrations, `getCurrentUserId`.
2. Content pipeline: download, select, build levels, validate, seed. Enable levels 1 to 3.
3. SRS engine and answer checking (pure, tested).
4. Lessons and reviews UI.
5. Dashboard, item pages, level browser, settings, credits.
6. Write mnemonics for the remaining levels in waves (enable as written).
7. Optional: VOICEVOX audio files for vocab (credit VOICEVOX and the chosen voice per its terms).

## 12. Later (phone)

Switch `DATABASE_URL` to a hosted libSQL database (e.g. Turso), add login (replace `getCurrentUserId`), deploy (e.g. Vercel). Pages are already mobile-friendly.
