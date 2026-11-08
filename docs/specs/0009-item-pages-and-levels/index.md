# 0009. Item pages, notes, and level browser

**Date**: 2026-10-13 (updated 2026-11-08 for Expo Android)
**Status**: Accepted

## Summary

Every radical, kanji, and vocab item gets its own page: what it means, how it reads, its mnemonics, what it is built from, where it is used, its stage, and when it is next reviewed. You can write your own meaning and reading notes and add synonyms right inside those cards, and reviews accept a synonym from the next session on. The Levels tab lists every level with its progress and your totals per stage, and each level opens as a grid of tiles in their type colors with a stage colored bar. This update replaces the first version, written for Next.js server pages; the layout was picked from mockups on 2026-11-08.

## Requirements

**User stories**:
- As a learner, I want one page per item with everything about it, so I can look anything up outside a lesson.
- As a learner, I want to fix a mnemonic I dislike with my own note, and see that note wherever the mnemonic shows.
- As a learner, I want to add a synonym so that an answer I keep giving, and that is right, counts in reviews.
- As a learner, I want to see every level and how far I am in each, colored by stage.
- As a learner, I want to hear how a vocab word sounds.

**Acceptance criteria**:
- **AC-1**: `/subjects/[id]` opens for every subject, locked ones included, and shows top to bottom: a hero band in the type color (type label and level, characters, primary meaning); a stage strip (stage label from `stageGroup`, next review text per AC-3); a Meaning card (primary meaning, "Also accepted" meanings, the meaning mnemonic, your meaning note, your synonyms); for kanji and vocab a Reading card (readings as on the lesson page, primary ones highlighted, the reading mnemonic, your reading note); and a components card ("Radicals in this kanji" or "Kanji in this word") as `SubjectChip`s with stage dots. Radicals have no Reading card.
- **AC-2**: A "Used in (N)" card lists, as `SubjectChip`s with stage dots, every subject whose `component_ids` include this one, across all levels, ordered by level, then type, then position: radicals list kanji, kanji list vocab. The card is hidden when the list is empty (always for vocab).
- **AC-3**: The next review text is: "Locked" with no assignment; "Lesson ready" at stage 0; "Retired" at stage 9; "Now" when `available_at` is at or before now, or missing at stages 1 to 8 (bad data); "in N min" under one hour (rounded up); "in N h" under 24 hours (whole hours, rounded down, at least 1), which wins even when that time falls tomorrow; otherwise "Tomorrow 2 PM" style when it falls on the next local calendar day; "Wed 2 PM" style when it falls within the next 7 local calendar days; "Nov 20" style after that, with the year added ("Nov 20, 2027") when it is not this year. Hours use the same device locale hour format as the Home forecast (`localHour` in `src/components/home/forecast-label.ts`, exported for reuse). Now comes from `now()` in `src/lib/clock`, so the debug clock moves it.
- **AC-4**: You edit a note in place: "Add meaning note" (or "Add reading note") or tapping an existing note turns it into a multiline field filled with the current text, with Save and Cancel. Save trims the text and writes it with `upsertNote`; an empty field clears the note (`null`). Cancel restores the saved text. A note is at most 1000 characters; the field stops there and shows a counter ("812 / 1000") once you pass 900. Notes are editable on locked items too. A screen reload when the page comes back into view never resets a note that is open for editing, and a successful save updates the card from the saved text without reloading the page.
- **AC-5**: Under "Your synonyms" each synonym is a chip with a remove button, followed by a field and an Add button. A synonym is trimmed with inner spaces collapsed, must be 1 to 64 characters, and an item holds at most 8. It is refused when it has Japanese script (`hasJapaneseScript`), since the meaning field never matches kana or kanji; when its `normalizeMeaning` form is empty (for example "!!!"); or when any of its `meaningForms` equals any `meaningForms` of this item's meanings or current synonyms (so "run" is refused when "to run" is a meaning). A refused synonym shows the reason under the field ("Type an English meaning", "Already accepted", "Use 64 characters or fewer", "You can add up to 8 synonyms") and saves nothing. Remove matches the exact stored text. Adding or removing saves at once (the whole list, through `upsertNote`). The next lesson quiz or review session accepts it (0007 AC-12).
- **AC-6**: When a save fails, a toast says "Could not save. Try again." and nothing you typed is lost: an edited note stays open with your text, a synonym you added stays in the field and gets no chip, a removed synonym keeps its chip.
- **AC-7**: Your notes show read only wherever the mnemonic shows: on lesson pages, the meaning note under the meaning mnemonic and the reading note under the reading mnemonic, plus your synonyms after "Also accepted". In the lesson quiz and in reviews, the "Not quite" card after a wrong answer has a "Show details" toggle (collapsed for every new question) that reveals the mnemonic for the question's kind and your note for that kind. The toggle is hidden when that kind has neither a mnemonic nor a note. Notes and synonyms are read once when the lesson batch or review session loads, so an edit made on an item page during a session shows from the next session.
- **AC-8**: The Levels tab shows, at the top, five stage tiles (Seed, Sprout, Bloom, Harvest, Retired) with the same counts as Home's stage tiles (0008 AC-4) from the same function; then one row per level that has content, in order: "Level N", kanji passed / total, a progress bar for kanji passed, and a "Current" badge on your current level. A level with no kanji shows "No kanji" and an empty bar. Every level above your current level is greyed with "Locked" (whatever its assignments) but still opens. Stage 0 (lesson) items are in no stage tile, as on Home. Tapping a row opens `/levels/[n]`.
- **AC-9**: `/levels/[n]` shows "Level N" and three sections, Radicals, Kanji, Vocabulary, each with "X/Y passed" and a grid of tiles in content order. A tile has the type color background, the characters, the primary meaning on one line (cut with an ellipsis), and a bar along the bottom in the item's stage group color. An item with no assignment is a grey tile with no bar. A legend under the grids names the seven states (Locked, Lesson, Seed, Sprout, Bloom, Harvest, Retired). Radical and kanji grids have 5 tiles per row and vocab 3, with tiles stretching to fill the row's width; tile text caps its font scale at 1.2 (`maxFontSizeMultiplier`). Tapping a tile opens its item page. TalkBack reads each tile as one label in `SubjectChip`'s format, for example "kanji 大, large, Sprout", "kanji 東, east, Locked", "kanji 本, book, Lesson".
- **AC-10**: Vocab item pages and vocab lesson pages show a Play button beside the readings that speaks the first primary reading, in kana, with `expo-speech` (`language: "ja-JP"` and the found Japanese voice's `identifier` as `voice`). The voice check starts at app launch; the button is hidden until a voice whose language starts with `ja` is found, and stays hidden when there is none or the check fails (0001 §9). Tapping while it speaks restarts it; leaving the screen stops it.
- **AC-11**: `/subjects/[id]` and `/levels/[n]` accept only a param matching `/^[1-9]\d{0,8}$/` (so "abc", "1.5", "0", "-1", "007" are rejected). A rejected param, an id that matches no subject, or a level that has no subjects show a "Not found" message with a Back button; nothing crashes.
- **AC-12**: The item page, the Levels tab, and the level page load from local queries each time they come into view; a load failure shows an error card with the message and "Try again". All three read cleanly at 360dp width with font scale 1.3, in light and dark, every touch target is at least 48dp, and every chip and tile has a TalkBack label.

## Decision

**Chosen option**: notes and synonyms edited in place inside the Meaning and Reading cards of a new item page, a Levels tab of level rows under a stage tile row, and level pages of type colored tiles with a stage bar. All data comes from new local services, `src/lib/study/items.ts` and `src/lib/study/levels.ts`, built on the existing queries; notes write through the existing `upsertNote`. There is no schema change. Speech uses `expo-speech`, the one new package, already chosen in 0001.

**Implementation skills**: `vercel-react-native-skills` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-native-skills/`), for list and grid render performance · `expo-router` (`expo/skills`, `.agents/skills/expo-router/`), for the new `/levels/[n]` route and stack headers.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no schema change, no migration. Reads `subjects` (all columns), `assignments` (`srs_stage`, `available_at`), `user_settings.current_level`, `user_notes`. Writes only `user_notes` (`meaning_note`, `reading_note`, `synonyms`, `updated_at`) through `upsertNote`, which upserts on `(user_id, subject_id)`.

**Routes and files**:
- `src/app/subjects/[id].tsx`: replaces the placeholder. Root stack, pink app bar with back arrow, title = the characters.
- `src/app/levels/[n].tsx`: new, on the root stack, title "Level N". It does not clash with `(tabs)/levels.tsx`: the group is transparent, so `/levels` is the tab and `/levels/3` this screen. Both new screens get the root stack's `AppBar` header; set the title with `<Stack.Screen options>`. Chips and tiles `push` (the back arrow walks back through what you opened).
- `src/app/(tabs)/levels.tsx`: replaces the placeholder.
- `src/components/subject/`: new folder for the item page pieces: `Section`, `Mnemonic`, `Readings` (moved out of `LessonPage.tsx` and shared with it), `ItemHero`, `StageStrip`, `NoteField` (the in place editor), `SynonymEditor`, `SubjectTile` (the level grid tile), `SpeakButton` plus `use-japanese-voice.ts`, and the pure `next-review-label.ts`.
- `src/lib/answer/synonym.ts`: pure `cleanSynonym(text)` and `checkSynonym(text, meanings, synonyms)`, returning `{ ok: true, value }` or `{ ok: false, reason: "not_english" | "empty" | "too_long" | "duplicate" | "full" }`, built on `normalizeMeaning`, `meaningForms`, and `hasJapaneseScript` from `meaning.ts`. Pure, so ground rule 5 holds.

**Service surface** (every function takes `db` then `userId` first, per `src/lib/db/AGENTS.md`; `now` is milliseconds, like `upsertNote`):
| Function | Inputs after `db, userId` | Output | Errors |
|---|---|---|---|
| `getItemPage` (`items.ts`) | `subjectId: number` | `{ subject: Subject, assignment?: Assignment, components: Chip[], usedIn: Chip[], note: { meaningNote, readingNote, synonyms } }` where `Chip = SubjectSummary & { stage: number \| null }`; the screen computes the next review text with `nextReviewLabel` | `null` when no subject has that id |
| `saveNote` (`items.ts`) | `subjectId`, `patch: { meaningNote?: string \| null; readingNote?: string \| null }`, `now: number` | `{ ok: true, note }` (the saved values) | `not_found` (no subject); a thrown DB error → toast |
| `addSynonym` (`items.ts`) | `subjectId`, `text: string`, `now: number` | `SynonymResult`: `{ ok: true, synonyms: string[] }` · `{ ok: false, error: "not_found" }` · `{ ok: false, error: "invalid", reason }` (a type of its own in `items.ts`, since `ServiceResult` cannot carry `reason`) | as in the output |
| `removeSynonym` (`items.ts`) | `subjectId`, `text: string` (exact stored text), `now: number` | `{ ok: true, synonyms: string[] }` | `not_found` |
| `getLevelsOverview` (`levels.ts`) | `now: number` (for `getOrCreateSettings`) | `{ currentLevel, stages: Record<DashboardStage, number>, levels: { level, kanjiPassed, kanjiTotal }[] }` | a thrown DB error → error card |
| `getLevelPage` (`levels.ts`) | `level: number` | `{ level, sections: { type, passed, total, items: Chip[] }[] }` | `null` when the level has no subjects |
| `countStageGroups` (`dashboard.ts`, extracted) | none | `Record<DashboardStage, number>`; keeps the `group in stages` guard so lesson and locked are skipped | used by `getDashboard` and `getLevelsOverview` |
| `getNotes` (`queries/notes.ts`, new) | none | `Map<subjectId, { meaningNote, readingNote }>`, rows with both notes empty left out | one query over your rows, like `getSynonyms` |
| `getLevelTypeSummaries` (`queries/subjects.ts`, new) | none | `{ level, type, total, passed }[]` | grouped by level and type; the existing `getLevelSummaries` has no type split |

`addSynonym` and `removeSynonym` read the note and write it inside one `withTransaction`, so two quick taps cannot lose a synonym. `saveNote` works with no assignment and no notes row (it inserts one).

**Quiz details thread**: `LessonItem` and `ReviewItem` gain `details: { meaningMnemonic, readingMnemonic, meaningNote, readingNote }` (reviews load mnemonics with `getSubjectsWithMnemonics` and notes with `getNotes`; lessons already have the mnemonics). `QuizSubject` in `use-quiz-session.ts` gains the same `details` field; `src/app/lessons.tsx` and `src/app/reviews.tsx` pass it when they build quiz subjects; `QuizView` reads `subject.details` for "Show details". Nothing loads during a session.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Item page | characters, type, level, meanings, readings, mnemonics | `subjects` row by id (`getSubject`) |
| Item page | stage label | `stageGroup(assignment?.srsStage ?? null)` |
| Item page | next review text | `nextReviewLabel(assignment, now().getTime(), formatHour = localHour)` from `assignments.srs_stage`, `available_at`; device time zone through `Date`, hour format from the Home forecast's `localHour` |
| Item page | components and their stages | `subject.componentIds` → `getSubjectsByIds` + `getAssignments` |
| Item page | used in and their stages | `getUsedIn(subjectId)` + `getAssignments` |
| Item page, lessons, quiz details | your notes and synonyms | `user_notes` row (`getNote`, `getNotes`, `getSynonyms`) |
| Save note or synonym | `updated_at` | `now().getTime()` |
| Synonym check | this item's accepted forms | `meaningForms` of `subject.meanings` + current `synonyms`, against `meaningForms` of the input |
| Levels tab | stage tile counts | `countStageGroups` (`getStageCounts` grouped by `stageGroup`), the same as Home |
| Levels tab | levels listed, kanji passed / total | `getLevelTypeSummaries`, kanji rows; levels are those present in `subjects` |
| Levels tab | current level, locked rows | `user_settings.current_level` (`getOrCreateSettings`); locked = level above it |
| Level page | items in order, passed counts | `getSubjectsByLevel` + `getAssignments`; passed = stage ≥ `PASSED_STAGE` |
| Level page | tile colors | type color class; stage bar from `stageClasses[stageGroup(stage).group]`; locked tile `bg-stage-locked` |
| Speak button | text spoken | the vocab's first primary reading in kana (`readings.find(r => r.primary)`) |
| Speak button | shown or hidden, voice used | `Speech.getAvailableVoicesAsync()` started at app launch, first voice whose `language` starts with `ja`; its `identifier` is passed as `voice`; result cached for the app run; a rejected check counts as no voice |

**Key invariants**:
- App code never writes content tables (ground rule 6); this feature writes only `user_notes`.
- Stage group and colors come only from `src/theme/stage.ts`; no screen maps stages itself.
- The Levels tab and Home stage counts come from one function, so they cannot disagree.
- The synonym list stored is always trimmed, English only, with no two entries (or an entry and a meaning) sharing a `meaningForms` form, at most 8, each 1 to 64 characters.
- A session (lesson quiz or review) reads synonyms once at its start; edits made later count from the next session.

**Security model**: single local user. Every read and write is scoped by `getCurrentUserId()`; no network, no permissions. Notes are free text kept only on the phone.

**Configuration required**: none. New dependency `expo-speech`, installed with `npx expo install expo-speech` (it works in Expo Go); move it from "Planned" to installed in `AGENTS.md` through `/sync`.

**Critical test scenarios**:
- Add the synonym "huge" on 大's page, start a review of 大, answer "huge" → Correct; "hug" → wrong (typo rules still apply), verifies **AC-5**
- `checkSynonym`: blank, "!!!", おおきい, 65 characters, a ninth synonym, "Large " for 大 (equals a meaning), "huge" twice, "run" when "to run" is a meaning → each refused with its reason; "big guy" accepted, verifies **AC-5**
- `nextReviewLabel` at each boundary: no assignment, stage 0, stage 9, stage 3 with `available_at` null, due now, 59 min, 60 min, 23 h that falls tomorrow (still "in 23 h"), 25 h (Tomorrow), 6 calendar days, 8 calendar days, next year, verifies **AC-3**
- Route params "abc", "1.5", "0", "007" → Not found, verifies **AC-11**
- Save a meaning note, reopen the page → it shows; save an empty field → note cleared; Cancel → old text back, verifies **AC-4**
- `upsertNote` throws → toast, note stays open with the text, verifies **AC-6**
- Wrong answer in a review → "Show details" reveals the mnemonic and your note for that kind; the next question starts collapsed, verifies **AC-7**
- Seeded user: Levels tab stage tiles equal Home's; level rows show kanji passed / total; level above current greyed but opens, verifies **AC-8**
- `getLevelPage(1)` returns three sections in content order with stages; a level with no subjects returns `null`, verifies **AC-9**, **AC-11**
- `/subjects/999999` and `/subjects/abc` → "Not found" with Back, verifies **AC-11**
- Emulator with no Japanese voice → no Play button; with one → Play speaks おとな for 大人, verifies **AC-10**

## Build plan

Tracer Bullet: the item page first as a thin thread (route, service, query, real data), then editing, then the places notes show, then the level browser, then speech.

1. [x] Item page thread: `getItemPage`, `nextReviewLabel` with tests (export `localHour` from `forecast-label.ts`), the shared route param check, shared `Section` / `Mnemonic` / `Readings` moved out of `LessonPage`, the `/subjects/[id]` screen with hero, stage strip, Meaning, Reading, components, Used in, Not found, and the load error card, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-11**, **AC-12**
2. [x] Notes and synonyms: `checkSynonym` with tests, `saveNote` / `addSynonym` / `removeSynonym` with tests, `NoteField` and `SynonymEditor` in the cards, toast on failure, satisfies **AC-4**, **AC-5**, **AC-6**
3. [x] Notes everywhere: `getNotes`, `details` on lesson and review items, notes on `LessonPage`, "Show details" in `QuizView`, satisfies **AC-7**
4. [x] Level browser: `getLevelTypeSummaries`, `countStageGroups` extracted from `getDashboard` (Home tests still pass), `getLevelsOverview` and `getLevelPage` with tests, the Levels tab, `/levels/[n]`, `SubjectTile`, satisfies **AC-8**, **AC-9**, **AC-11**, **AC-12**
5. [x] Speak button: install `expo-speech`, `use-japanese-voice` and `SpeakButton` on vocab item and lesson pages, satisfies **AC-10**
6. [x] Emulator pass: 360dp, font scale 1.3, light and dark, TalkBack labels on the three screens, satisfies **AC-12**

## Consequences

**Positive**:
- Feature 7's open checks (0007 AC-11 and AC-12 with a real synonym) and feature 9's Levels count check (0008 AC-4) can finally run.
- Your note sits beside the mnemonic it fixes, on every screen that shows one.
- No migration: the table and its upsert were designed for this in 0002.

**Negative / tradeoffs**:
- A synonym added during a session only counts from the next session, because sessions load synonyms once at start (kept on purpose, 0007 AC-12).
- Mnemonics of locked items are readable before their lesson.
- Android voices vary by phone; some have no Japanese voice, and then there is no sound at all. Recorded audio is a later upgrade.
- The level grid renders up to about 90 vocab tiles at once in a `ScrollView`; fine at this size, but a level far larger would want a virtualized list.

**Neutral**:
- `LessonPage`'s inner pieces move to `src/components/subject/`; lessons look the same.
- `getDashboard` is refactored to call `countStageGroups`; its output does not change.

## Follow-up

- [ ] After this ships, run the waiting checks: 0007 `verify.md` synonym steps (AC-11, AC-12) and 0008 `verify.md` stage count step (AC-4).
- [ ] Tapping a Home stage tile could open the level browser filtered to that stage (0008 Follow-up).
- [ ] Speak button in reviews after answering was considered and left out of scope (decision 6); revisit if you miss it.
