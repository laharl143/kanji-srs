# 0001. Kanji SRS app architecture and product contract

**Date**: 2026-10-13 (revised 2026-11-01: Android app on Expo, replacing the Next.js web app)
**Status**: In Progress

## Summary

This is the foundation spec for a private kanji app that teaches Japanese up to JLPT N3 with spaced repetition (radicals, then kanji, then vocabulary). As of the 2026-11-01 revision it is an **Android app built with Expo (React Native)**. It installs as a sideloaded APK, works fully offline, keeps everything in SQLite on the phone, and sends local review reminders. Desktop and syncing between devices come later, and the data model is shaped so they can be added without a rewrite. The product contract (data model, pipeline, SRS math, answer checking, screens) carries over almost unchanged. Feature specs 0002 to 0010 hold the build plans; when they disagree with this spec, this spec wins.

## Requirements

**User stories**:
- As a learner, I want lessons and reviews scheduled by an SRS on my Android phone, with or without a signal, so that I learn N5 to N3 kanji without paying for a subscription.
- As a learner, I want a reminder when reviews are waiting, so that I keep the habit.
- As the builder, I want one written contract so that each feature can be built and checked on its own.

**Acceptance criteria**:
- **AC-1**: `npm run dev` on Windows starts the Expo dev server, and the app opens in Expo Go on your Android phone with no external services beyond Expo's own tooling.
- **AC-2**: No WaniKani content, API, name, logo, colors, or UI copy is used anywhere (rules in "Non negotiable rules" below).
- **AC-3**: All ~650 N5 to N3 kanji, their components, and matching vocab are placed in levels with no item before its parts.
- **AC-4**: SRS logic, answer checking, reminder scheduling, and content validation have passing unit tests (Vitest); the core loop passes a Maestro flow on an Android device or emulator.
- **AC-5**: Adding sync later needs no rewrite of existing rows: every progress row has `user_id`, review rows have UUID ids, and notes carry `updated_at`.
- **AC-6**: An APK built with EAS Build installs on your phone, and a full lesson plus review session works with airplane mode on.
- **AC-7**: With reviews waiting, the phone shows a daily summary notification at your chosen time and a due ping when new reviews unlock (at most one per hour), and none during quiet hours.

## Decision

**Chosen option**: Option 4: one Expo (React Native) app for Android, local SQLite through `expo-sqlite` and Drizzle, content bundled in the app, no backend for now.

One TypeScript project holds the app, the pure logic, and the content pipeline. Everything the app needs lives on the phone, so it works offline from first launch. The review log and ids are shaped for a later sync through a Cloudflare Worker and D1 (recorded under Deferred decisions below), but none of that is built now.

**Implementation skills**: `tailwind-design-system` (`wshobson/agents`, `.agents/skills/tailwind-design-system/`), its tokens and conventions carry into NativeWind. `vercel-react-best-practices` (`.agents/skills/vercel-react-best-practices/`) now applies only to its general React rules; its Next.js parts no longer apply.

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript (strict) | one language for pipeline, logic, and UI |
| App framework | Expo (current SDK, 58 at time of writing) with React Native | real installed Android app; agents know it well; Expo Go for quick development |
| Navigation | Expo Router, routes in `src/app/` | file based routes that mirror §8, so screens map one to one |
| Styling | NativeWind v4 with Tailwind CSS 3.4 (its supported pairing; NativeWind v5 for Tailwind 4 was still a preview) | keeps the Tailwind tokens from 0003 and the tailwind skill; the old Next.js Tailwind 4 config is removed |
| Primary DB | `expo-sqlite` (SQLite file on the phone) | offline, fast, no server |
| ORM / migrations | Drizzle ORM (`drizzle-orm/expo-sqlite` driver) + drizzle-kit (`dialect: sqlite`, `driver: expo`); `npm run db:generate` runs `drizzle-kit generate`; migrations are bundled (Metro `sourceExts` adds `sql`, plus `babel-plugin-inline-import`) and run on launch with `useMigrations` in the root layout | typed schema, plain SQL migrations, same SQLite dialect a later D1 backend uses |
| Content delivery | `npm run pipeline:bundle` writes one `content/bundle.json` (enabled levels, mnemonics merged) and `content/content-version.txt` (SHA-256 of the bundle); the app imports the bundle and reseeds on launch when the version changes | works offline from first launch; stable ids keep progress safe |
| Kana input | `wanakana` `toKana(text, { IMEMode: true })` in the `TextInput` change handler | `wanakana.bind` needs the browser DOM, so convert in the handler instead |
| Japanese font | Noto Sans JP via `expo-font` (`@expo-google-fonts/noto-sans-jp`) | renders the same on every phone; OFL license, credited |
| Audio | `expo-speech` with `language: "ja-JP"` | Android's built in text to speech, free; hide the button when no Japanese voice is installed |
| Notifications | `expo-notifications`, local scheduled notifications only (no push server) | reminders with no backend; inexact timing, so no exact alarm permission |
| IDs | `expo-crypto` `randomUUID()` for review rows | merge safe ids for a later sync |
| Unit tests | Vitest for pure modules and pipeline; query modules tested in Node against `better-sqlite3` (fall back to Node's built in `node:sqlite` if it will not install on Windows) with the same Drizzle schema and migrations | fast tests without a device |
| End to end tests | Maestro flows in `maestro/`, run against the `e2e` profile APK (not Expo Go) on an emulator or USB phone; `appId` is the Android package | drives the real app; simple YAML |
| Pipeline scripts | TypeScript via `tsx` on Node | unchanged |
| Build and install | EAS Build free tier; `eas.json` profiles `preview` (`buildType: "apk"`) and `e2e` (same, plus `EXPO_PUBLIC_E2E=1`); `autoIncrement` for `versionCode`; EAS generates and keeps the signing keystore; Android package `com.edduenas.kanjisrs` in `app.json` | no Android Studio, JDK, or Gradle on Windows; 15 Android builds a month at check time |
| Dev server | `npm run dev` runs `expo start`; use `expo start --tunnel` if the Windows firewall blocks the phone on your network | Expo Go on the phone must match the project's SDK |
| Auth | none; `getCurrentUserId()` returns `"local"` | single user; a sync token comes with sync |
| Backend / hosting | none for now | phone only; see Deferred decisions |
| Backup | none for now (accepted risk until sync) | your choice, 2026-11-01 |
| Observability | console logging, Expo dev tools | personal app |

Node 22 LTS or newer for the pipeline and tooling. Use current stable package versions at build time; the landscape check (2026-11-01) found the Drizzle Expo driver still on pre release tags, so pin exact versions at scaffold time and note them in `AGENTS.md`.

### Deferred decisions (already made, not built now)

- **Desktop and sync**: when desktop arrives, add a `sync/` folder with a Cloudflare Worker and a D1 database (SQLite). Devices push and pull review events and notes; assignments are rebuilt by replaying reviews in `created_at` order through `src/lib/srs`, so two devices can never conflict on SRS state. Notes merge last write wins on `updated_at`. A device proves it is you with one long random sync token entered in Settings. Desktop then becomes the Expo web build or another client of the same Worker, decided at that time.
- **Backup**: until sync exists, progress lives only on the phone.

## Product contract

_Sections below are the approved design (2026-10-13, revised 2026-11-01 for Android). Feature specs reference them as "0001 §N"._

### §1 Non negotiable rules

1. **No WaniKani content.** Do not scrape, copy, paraphrase, or import WaniKani's (or any paid course's) mnemonics, radical names, example sentences, audio, or level lists. Do not use its API.
2. **No WaniKani branding.** Do not use the name, logo, colors, or a copy of its UI. SRS stage names are this app's own (see §6).
3. **Original mnemonics only.** Radical names and every mnemonic are invented from scratch.
4. **Credit the open data sources** (and the bundled font) on a Credits screen.

### §1 Success criteria

- `npm run dev` on Windows starts Expo and the app runs in Expo Go on your phone.
- A sideloaded APK runs lessons and reviews with no connection.
- You can do lessons and reviews from level 1 through at least level 3 on the first content release, and through the final level once all mnemonics are written.
- All ~650 N5 to N3 kanji, their components, and the matching vocabulary are placed in levels with no item appearing before its parts.
- The SRS logic, answer checking, reminder scheduling, and content validator have passing unit tests. One Maestro flow passes.
- Adding sync later adds a Worker and a sync module; existing rows keep their shape.

### §1 Out of scope (for now)

Desktop, syncing between devices, backup, login and accounts, Play Store release, kana only vocabulary, example sentences, stroke order animation, VOICEVOX audio (optional final phase), JLPT N2 and N1.

### §3 Architecture

#### Folder layout

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
  enabled-levels.json  levels shipped in this build
  content-version.txt  hash/version of the current content build
src/
  app/                 Expo Router routes (one file per §8 screen) and _layout.tsx
  components/          shared UI components
  lib/srs/             pure SRS logic, no DB or framework imports
  lib/answer/          answer checking (pure)
  lib/reminders/       pure reminder schedule (which notifications, when)
  lib/db/              Drizzle schema, expo-sqlite client, queries, migration runner
  lib/content/         reseeds content tables from the bundled content/ files
  lib/clock/           now(), with a test offset in E2E builds only
  lib/notifications/   thin wrapper that hands lib/reminders output to expo-notifications
drizzle/               generated SQL migrations (bundled into the app)
assets/                fonts, icons, splash
maestro/               end to end flows
tests/unit/            Vitest tests not kept next to their source
docs/                  scope and specs
```

`sync/` (Cloudflare Worker) is added only when sync is built.

#### Boundaries

- `src/lib/srs`, `src/lib/answer`, and `src/lib/reminders` are **pure functions**. They take plain objects and the current time (`now: Date`) as arguments and never read the clock, DB, environment, or any Expo or React Native module. This keeps the scheduling rules in one place and testable in Node.
- `src/lib/db` is the only code that talks to the database. Query functions take the Drizzle database as a parameter so the same code runs on `expo-sqlite` in the app and on `better-sqlite3` in tests.
- Screen level hooks and services glue the layers: load rows → call pure functions → write results in one transaction. (There are no server actions or route handlers any more.)
- Content is **read only** at runtime. User progress never writes to content tables; only the reseed in `src/lib/content` writes them.
- `src/lib/clock` is the only place that reads the device clock. `now()` is synchronous: in E2E builds it adds an offset loaded from `app_meta.clock_offset_ms` into memory at startup (and updated in memory whenever the debug screen sets it), so it never waits on the database. Reminders use `now()` only for planning; Android fires them on the real clock, and E2E does not check delivery.
- All writes go through one helper, `withTransaction(db, fn)`, in `src/lib/db`. Drizzle transactions are synchronous on `better-sqlite3` and asynchronous on `expo-sqlite`, so the helper hides that difference and queries use the `await db.select()` builder form only.
- Foreign keys: `PRAGMA foreign_keys = ON` at open. Progress tables have **no** foreign key to `subjects`, so a reseed can never cascade into progress.

#### Single user now, multi user later

Every progress table has `user_id TEXT NOT NULL`. For now, the app uses a constant `LOCAL_USER_ID = "local"`, read from one helper `getCurrentUserId()`. Adding sync or accounts later changes that helper and adds a sync module; no existing row changes shape.

#### App startup

1. Keep the splash screen up. Open the SQLite database and run bundled Drizzle migrations (`useMigrations` in `src/app/_layout.tsx`); show a blocking error screen if a migration fails.
2. Compare the bundled `content-version.txt` with `app_meta.content_version`. If they differ (or on first launch), reseed the content tables in one transaction (§5.6) while a loading screen shows.
3. On first launch, create the local user's settings and unlock level 1 (§6.4).
4. Run `computeUnlocks` (so content added by a reseed unlocks where it should), load the clock offset (E2E builds), then hide the splash.
5. Reschedule reminders (§6.5).

### §4 Data model

#### Content tables (rebuilt from the bundled `content/` files by the reseed)

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

**app_meta**: `key TEXT PK, value TEXT`. Holds `content_version`, `notif_permission_asked` (`"1"` once asked), and in E2E builds only, `clock_offset_ms`.

#### Progress tables

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

**reviews** (append only log; the future sync source of truth)

`id TEXT PK (UUID v4), user_id, subject_id, created_at, starting_stage, ending_stage, incorrect_meaning_count, incorrect_reading_count`

**user_notes**: `user_id, subject_id, meaning_note, reading_note, synonyms (JSON string array), updated_at INTEGER`

**user_settings**

| Column | Type | Default |
|---|---|---|
| user_id | TEXT PK | |
| current_level | INTEGER | 1 |
| lesson_batch_size | INTEGER | 5 |
| reminder_daily_enabled | INTEGER (0/1) | 1 |
| reminder_daily_time | TEXT `HH:MM` | `"08:00"` |
| reminder_due_enabled | INTEGER (0/1) | 1 |
| quiet_hours_start | TEXT `HH:MM` | `"22:00"` |
| quiet_hours_end | TEXT `HH:MM` | `"08:00"` |
| created_at | INTEGER | |

### §5 Content pipeline

All scripts live in `pipeline/src/`, run on Node via `npm run pipeline:<step>`, and write into `content/`, which the app bundles.

#### 5.1 Sources

| Data | Source | License | Use |
|---|---|---|---|
| Kanji meanings, readings, frequency | KANJIDIC2 (EDRDG) | CC BY-SA 4.0 | kanji fields |
| Vocabulary meanings, readings | JMdict English (EDRDG) | CC BY-SA 4.0 | vocab fields |
| Kanji → components | KRADFILE / kradfile-u (EDRDG) | CC BY-SA 4.0 | radical links |
| Which kanji and words are N5 to N3 | Jonathan Waller's JLPT lists (tanos.co.uk) | Check before use (believed Creative Commons BY) | item selection |
| Japanese font | Noto Sans JP (Google Fonts) | SIL Open Font License 1.1 | app text |

The `download` script records each file's URL, date, and SHA-256 in `pipeline/raw/SOURCES.json`. **Before using the tanos lists, confirm their license on the site and record it in `SOURCES.json`.** If they are not usable, fall back to the pre 2010 JLPT levels in KANJIDIC2 (`<jlpt>` 4 and 3 → treat old 4+3 as N5+N4, plus old 2 kanji ranked by frequency until ~650 kanji total) and report the change.

#### 5.2 Selection

- **Kanji:** union of the N5, N4, N3 kanji lists (~650).
- **Vocabulary:** N5 to N3 vocab entries whose written form contains at least one kanji and whose kanji are *all* in the selected kanji set. Meanings and readings come from the matching JMdict entry (match on written form + reading). Keep up to 3 meanings. Words with no JMdict match are dropped and listed in the build report.
- **Radicals:** every KRADFILE component used by a selected kanji. If a component is itself a selected kanji, it still gets a radical entry (the radical teaches the shape, the kanji teaches the meaning and reading). Components with no glyph in Noto Sans JP are listed in the report for manual review.

#### 5.3 Level building

1. Order kanji by JLPT (N5, then N4, then N3), then by KANJIDIC2 frequency (most common first; missing frequency goes last).
2. Pack kanji into levels of **25** in that order (last level may be smaller). Expected ~26 levels.
3. **Radical placement:** each radical goes in the level of the first kanji that uses it.
4. **Vocab placement:** each word goes in the level of its latest introduced kanji.
5. **Position:** within a level, radicals then kanji then vocab, each in the order above.
6. IDs: assign once and persist. A rebuild keeps existing IDs for existing items (match on `type + characters`) and appends new IDs for new items. Never renumber.

Output: `content/subjects.json` (array of subject objects matching §4, without mnemonics) and a printed build report (counts per level, dropped items, warnings).

#### 5.4 Mnemonics (written by Bob)

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

#### 5.5 Validation (`npm run pipeline:validate`, also run by `merge` and in `npm test`)

Fails if any of these hold:
- A kanji's radical is in a later level than the kanji.
- A vocab's kanji is in a later level than the vocab.
- A kanji or vocab has no meaning, or a kanji/vocab has no reading.
- A subject in an "enabled" level has no mnemonic (enabled levels are listed in `content/enabled-levels.json`, so content can ship in waves).
- A kanji meaning mnemonic does not contain the name of every one of its radicals (case insensitive).
- Two radicals share a name.
- Duplicate IDs, or an ID changed for an existing item.

#### 5.6 Reseeding (in the app, `src/lib/content`)

`npm run pipeline:bundle` merges `content/subjects.json` with `content/mnemonics/*.json` for the levels in `enabled-levels.json` into one `content/bundle.json` (mnemonic fields set: `meaning_mnemonic`, `reading_mnemonic`, and for radicals the `name` becomes the primary meaning), then writes its SHA-256 to `content-version.txt`. It refuses to run if validation fails.

On launch, when the bundled `content-version.txt` differs from `app_meta.content_version`, the app **upserts** every subject from `bundle.json` by `id` (`INSERT ... ON CONFLICT(id) DO UPDATE`, in batches of a few hundred rows) and then writes the new `content_version`, all in one transaction. It never deletes subjects (ids are never reused, §5.3) and never touches progress tables. A content release therefore ships as a new APK. The pipeline validator must pass before a build (`npm test` runs it), so the app never bundles invalid content.

### §6 SRS rules

#### 6.1 Stages (all in `src/lib/srs/config.ts`)

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

#### 6.2 Lessons

Finishing a lesson (learn + quiz once correct) moves an assignment from stage 0 to stage 1 and sets `started_at` and `available_at`. Lessons are shown in `position` order within the lowest level first, radicals → kanji → vocab.

#### 6.3 Reviews

- A review item has one or two questions: **meaning** for all types; **reading** for kanji and vocab.
- Questions from all due items are shuffled together. An item is complete when all its questions have been answered correctly once (wrong answers queue that question again).
- On completion, with `wrong = incorrect_meaning_count + incorrect_reading_count`:
  - `wrong == 0` → `new_stage = stage + 1` (max 9).
  - `wrong > 0` → `penalty = stage >= 5 ? 2 : 1`; `new_stage = max(1, stage - ceil(wrong / 2) * penalty)`.
- Write a `reviews` row (new UUID) and update the assignment (`available_at`, plus `passed_at` the first time stage reaches 5 and `burned_at` at stage 9), in one transaction.
- **Wrap up:** stop pulling new items; finish items already started.

#### 6.4 Unlocking and level up

- At start: create assignments (stage 0) for all level 1 radicals, and level 1 kanji with no radicals.
- After each review, run `computeUnlocks`:
  - A kanji at or below the user's current level unlocks when **all** its radicals are passed.
  - A vocab at or below the current level unlocks when **all** its kanji are passed.
- **Level up:** when ≥ 90% of the current level's kanji are passed, `current_level += 1`, and the new level's radicals unlock (plus any kanji whose radicals are already all passed).
- **Skip ahead (Settings):** setting level N marks every subject below level N as stage 9 (Retired) without reviews, then unlocks level N as at start. Confirm with a dialog.

#### 6.5 Review reminders (`src/lib/reminders`, pure)

`planReminders({ assignments, settings, now, timeZoneOffsetMinutes })` returns a list of `{ fireAt, kind: "daily" | "due", count }`. `src/lib/notifications` cancels every scheduled notification and schedules that list as one shot date notifications.

- **Due count** at a time `t` = assignments with stage 1 to 8 and `available_at <= t`. Every notification shows the total due count at its `fireAt`.
- **Daily summary** (when `reminder_daily_enabled`): one per day for the next 7 days at `reminder_daily_time` local time, saying "N reviews waiting". Skip today if that time has already passed, and skip any day whose count is 0.
- **Due ping** (when `reminder_due_enabled`): baseline = the due count at `now`. For each hour start in the next 24 hours where the due count is higher than the last count notified (baseline first), schedule a ping at that hour start, saying "N reviews are ready". At most one per hour.
- **Quiet hours**: nothing fires between `quiet_hours_start` and `quiet_hours_end` (the window may cross midnight; equal start and end means no quiet hours). A due ping that falls inside is moved to `quiet_hours_end`. After moving, merge pings that share an hour (keep the later count), and if a ping shares an hour with a daily summary, keep only the summary. The daily time itself is allowed even inside quiet hours (you chose it).
- **Cap**: at most 31 scheduled notifications (7 daily + 24 pings), far below Android's limit.
- **Local time**: the wrapper turns each local time into an instant per date with `Date`, so a daylight saving change inside the 7 days is handled. The pure module takes `localTimeToInstant(date, "HH:MM") => Date` and `instantToLocalHHMM(Date) => string` as injected functions instead of a single offset.
- **Notification look**: one Android channel `review-reminders` named "Review reminders" (default importance, default sound). Title "Reviews waiting" (daily) or "Reviews ready" (due), body as above. Tapping opens `/reviews` if reviews are due, else `/`.
- **Counts stay true** because progress only changes when you use the app, and every use reschedules.
- **When to reschedule**: after startup, when the app returns to the foreground, after each lesson or review session ends, and after reminder settings change.
- **Values and their sources**: `available_at` and stage from `assignments`; times and switches from `user_settings`; `now` from `src/lib/clock`; local time conversion from the device time zone, done in the wrapper, not in the pure module.
- **Permission**: Android 13+ needs the notification permission at runtime. Ask once, after your first finished lesson session (when `app_meta.notif_permission_asked` is not set), or when you turn a reminder on; then set `notif_permission_asked`. If you deny it, Settings shows that notifications are off, with a button to Android's app settings. Timing is inexact (no `SCHEDULE_EXACT_ALARM`), so a reminder may arrive a few minutes late.
- **Where it is verified**: reminder delivery is checked on the installed APK only; Expo Go handles notification channels and icons differently.

### §7 Answer checking (`src/lib/answer`)

- **Reading input:** a `TextInput` whose change handler runs `wanakana.toKana(text, { IMEMode: true })`, so typed romaji becomes hiragana as you type (a Japanese keyboard also works). Compare to accepted readings after normalizing katakana → hiragana.
- **Kanji reading kind:** each kanji question accepts its primary readings. If the answer matches a reading of the *other* kind (e.g. kun'yomi when on'yomi is primary), return `wrong_kind` → UI shakes with "Looking for the on'yomi" and the answer does not count as wrong.
- **Meaning input:** lowercase, trim, collapse spaces, strip punctuation. Accept exact matches of meanings plus user synonyms. Accept typos when Levenshtein distance ≤ `0` for length ≤ 3, `1` for length 4 to 5, `2` for length 6 to 9, `floor(len / 4)` for longer. Return `close` (accepted, shown as "close enough").
- Results: `correct` | `close` | `wrong` | `wrong_kind` | `invalid` (e.g. romaji left in reading field, which should shake, not count).

### §8 Screens

Routes are Expo Router files under `src/app/`.

| Route | Content |
|---|---|
| `/` Dashboard | Lessons available count + Start button; reviews due now + Start button; next 24 hours review forecast by hour; current level progress (radicals and kanji passed / total, 90% marker); counts by stage group (Seed, Sprout, Bloom, Harvest, Retired). |
| `/lessons` | Batch of `lesson_batch_size`. For each item: characters, meanings, readings, components, mnemonics, play audio (vocab). Then a quiz over the batch using the review question flow; passing the quiz finishes the lessons. |
| `/reviews` | One question at a time. Header shows remaining count and accuracy. Feedback after each answer; expand item details after a wrong answer. Wrap up button. Summary at the end (correct, incorrect, stage changes). |
| `/subjects/[id]` | Full item details, used in list, your meaning/reading notes and synonyms (editable), SRS stage and next review time. |
| `/levels` and `/levels/[n]` | Grid of every item in a level, colored by stage. |
| `/settings` | Lesson batch size; reminders (daily on/off and time, due pings on/off, quiet hours, notification permission state); skip ahead to level; reset all progress (confirm dialog). |
| `/credits` | Data sources and licenses from §5.1. |

UI rules: phone first layout (works from 360dp wide), with safe areas respected; light and dark themes follow the system; type colors distinguish radical / kanji / vocab; Japanese text uses Noto Sans JP; reviews work from the keyboard (the submit key on the soft keyboard submits, a second press continues); touch targets at least 48dp (the Android guideline); the Android back button leaves a session only after a confirm when answers are in progress (Expo Router `beforeRemove` / `BackHandler`); edge to edge layout with the system bars themed to match.

### §9 Error handling

- `npm test` fails if pipeline validation fails, so invalid content never ships in a build.
- A migration failure on launch shows a blocking error screen with the message (no silent data loss).
- If the DB has progress for subject IDs that no longer exist in content, the reseed logs and skips them (never deletes progress).
- Services validate input (e.g. subject IDs belong to the user's due items) and return a typed error; the UI shows a toast and keeps the current question.
- No Japanese text to speech voice → hide the audio button.
- Notification permission denied → reminders are skipped silently, and Settings shows the state.

### §10 Testing

- **Vitest, `src/lib/srs`:** stage up, stage down with each penalty case, floor at 1, hour rounding, passed and burned timestamps, unlock rules, level up at exactly 90%, skip ahead.
- **Vitest, `src/lib/answer`:** romaji leftovers, katakana normalization, wrong kind, typo thresholds at each boundary, synonyms.
- **Vitest, `src/lib/reminders`:** daily times across 7 days, zero count days skipped, one ping per hour, quiet hours crossing midnight, ping moved to quiet end and merged with a daily summary, both switches off.
- **Vitest, pipeline:** level builder on a small fixture (ordering, radical and vocab placement, stable IDs on rebuild) and each validator rule.
- **Vitest, `src/lib/db` queries:** run against `better-sqlite3` in memory with the same Drizzle schema and migrations.
- **Maestro** (on the `e2e` profile APK): fresh install → do the level 1 lesson batch → advance the clock 4 hours → review those items correctly → stages show 2. The clock moves through a hidden debug screen that sets `app_meta.clock_offset_ms`, present only in builds with `EXPO_PUBLIC_E2E=1` (see 0004 "Clock").
- `npm test` runs Vitest; `npm run test:e2e` runs `maestro test maestro/`.

## Build plan

This is the stack decision; the scaffold steps are derived by `/develop stack & architecture` from `## Proposed stack` above. The 2026-11-01 revision means the Next.js scaffold is replaced by an Expo scaffold (the pipeline, `content/`, docs, Husky, ESLint, Prettier, and Vitest setup carry over). Feature work lives in specs 0002 to 0010 (see `docs/scope/scope.md`).

## Consequences

**Positive**:
- A real Android app that works with no signal and reminds you when reviews are waiting.
- One project, one language; the pure SRS, answer, and reminder modules are testable in Node with no device.
- The review log and ids are already sync shaped, so desktop and sync add code without reshaping data.
- No backend to pay for or keep running.

**Negative / tradeoffs**:
- No backup: losing or resetting the phone loses your progress until sync exists.
- No desktop for now.
- React Native is a heavier toolchain than a web app: Expo account for EAS, Maestro needs Android platform tools (`adb`) and an emulator or USB phone, and EAS free builds can queue for a long time.
- A content release (new mnemonic wave) means a new APK build and install, which uses EAS build quota.
- The Drizzle Expo driver was on pre release tags at the time of the check; pin versions and expect some churn.
- Specs 0002, 0003, 0004, 0007, 0009, and 0010 were written for Next.js and need updates (see Follow-up).

**Neutral**:
- Content ships in waves via `content/enabled-levels.json`.
- The Next.js 16.4.3 patch (scope feature 13) is superseded by this change; its work goes away with the Next.js scaffold.

## Follow-up

- [ ] Confirm the tanos.co.uk JLPT list license before first pipeline run (0005).
- [ ] Update stale feature specs for Android before building them: 0002 (expo-sqlite client, `withTransaction`, `better-sqlite3` tests, no progress foreign keys, `reviews.id` UUID, `user_notes.updated_at`, `app_meta`, reminder columns; also name every primary key and index, including `assignments(user_id, available_at)` and `reviews(user_id, created_at)`), 0003 (also the stage to color mapping, including a "locked" state), 0006 (unlock eligibility by `subject.level <= current_level` in one function inside the review transaction; level up as `passed * 10 >= total * 9`, with a level of 0 kanji leveling up at once; skip ahead sets all timestamps to now and `available_at` null, writes no review rows, and only moves up), 0004 and 0006 (lesson quiz writes no review rows; review queue order and cap; session state is in memory only; accuracy = questions right on the first try / questions answered), 0010 (batch size bounds and the time picker component), 0003 (NativeWind tokens, React Native base components, dev preview screen), 0004 (Maestro instead of Playwright, debug clock screen instead of a test clock route, bundled content reseed instead of `db:seed`), 0007 (`toKana` in the input handler instead of `wanakana.bind`), 0009 (`expo-speech` instead of browser speech), 0010 (reminder settings, credits for the font).
- [ ] Review reminders (§6.5) has no feature spec or scope row yet; enroll it as a scope feature.
- [ ] Root `AGENTS.md` stack, commands, and rule 5 (add `src/lib/reminders` to the pure modules) need updating after the re scaffold (`/sync`).
- [ ] Desktop and sync (Worker + D1, event replay, sync token) and backup stay in the scope's Deferred list with the decisions recorded above.

## Rationale

See [rationale.md](rationale.md).
