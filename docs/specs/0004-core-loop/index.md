# 0004. Core study loop (tracer slice)

**Date**: 2026-10-13 (revised 2026-11-02 for Expo Android)
**Status**: Accepted

## Summary

This is the first working thread through every layer of the Android app. Real open data becomes level 1 content, ships inside the app, and is loaded into SQLite on launch. You take a lesson, and a review four hours later moves the item up an SRS stage (spaced repetition step). Each part is narrow on purpose; later slices (0005 to 0010) thicken one part at a time. The 2026-11-02 revision replaces the Next.js parts (server actions, test clock route, `db:seed`, Playwright) with their Expo equivalents from 0001.

Decision record (context, options, rationale): [rationale.md](rationale.md). Verify steps: [verify.md](verify.md).

## Requirements

**User stories**:
- As a learner, I want to learn level 1 on my phone and review it later, so that the whole loop works before anything is polished.
- As the builder, I want the loop proven by a test that runs in `npm test`, so that later slices cannot silently break it.

**Acceptance criteria**:
- **AC-1**: `npm run pipeline:download` fetches the jmdict-simplified release assets (JMdict English, KANJIDIC2, kradfile) at the release tag pinned in `pipeline/src/sources.ts`, and the tanos N5 to N3 kanji and vocab lists from the URLs pinned there, into `pipeline/raw/`, and writes `pipeline/raw/SOURCES.json` with url, download date, sha256, and license for each file. A file already present is skipped unless `--force` is passed. The download works behind the corporate proxy when `HTTPS_PROXY` is set.
- **AC-2**: During the build, the tanos site is read and the owner confirms whether its license allows use; the decision (`tanosLicense: "usable" | "unusable" | "unconfirmed"` plus the license text) is recorded in `pipeline/src/sources.ts` and copied into `SOURCES.json`. Unless it is `"usable"`, the build uses the KANJIDIC2 old JLPT fallback from 0001 §5.1 and the build report says so, so the build never blocks on it.
- **AC-3**: `npm run pipeline:build` writes `content/subjects.json` with ids, levels, and positions for every level per 0001 §5.2 and §5.3, and prints a build report (items per level and type, dropped vocab, components with no Noto Sans JP glyph).
- **AC-4**: `content/enabled-levels.json` is `[1]`. `content/mnemonics/{radicals,kanji,vocab}.json` hold original radical names and mnemonics for every level 1 item, written per 0001 §5.4. `npm run pipeline:bundle` writes `content/bundle.json` and `content/content-version.txt` (SHA-256 of the bundle), and refuses to run when an enabled item has no mnemonic or a kanji meaning mnemonic does not name every one of its radicals.
- **AC-5**: On launch, after migrations, when the bundled content version differs from `app_meta.content_version`, the app upserts every bundled subject and writes the new `content_version` in one transaction, never deleting a subject or touching a progress row. On first launch it also creates the local user's settings and unlocks level 1 radicals and level 1 kanji with no radicals at stage 0. A relaunch with the same version changes nothing.
- **AC-6**: `/lessons` loads up to `lesson_batch_size` stage 0 items in 0001 §6.2 order and shows one item per page (characters, meanings, readings, component characters with their meanings, mnemonics) with Next and Back. The last Next starts the quiz. With no stage 0 items it shows "No lessons right now" and a button back to Home.
- **AC-7**: The lesson quiz asks meaning (and reading for kanji and vocab) for every batch item, shuffled together; a wrong answer puts that question back at the end of the queue. The moment all of an item's questions are answered correctly, that item moves to stage 1 with `started_at` = now and `available_at` = now + 4 hours rounded down to the hour, in its own transaction. The quiz writes no `reviews` row.
- **AC-8**: `/reviews` loads every due item (stage 1 to 8, `available_at` <= now), shuffles all questions together, and shows the number of items remaining in the header. A wrong answer puts that question back at the end of the queue and adds 1 to that item's wrong count for that question type (every wrong submission counts). When all of an item's questions are correct, the app writes one `reviews` row (new UUID) and updates the assignment per 0001 §6.3 (new stage, `available_at`, `passed_at` the first time stage reaches 5, `burned_at` at stage 9) in one transaction. With nothing due it shows "No reviews right now" and a button back to Home.
- **AC-9**: Completing a lesson item or review for a subject that is not pending (lesson) or not due (review), or has no assignment, returns a typed error and writes nothing. The screen shows a toast, drops that item's remaining questions from the session, and carries on; the write is never retried.
- **AC-10**: The reading field converts typed romaji to hiragana as you type (`wanakana.toKana(text, { IMEMode: true })` in the change handler). A reading is correct when it equals a primary reading (the rule that marks readings primary is under *Content rules*); a meaning is correct when the trimmed, lowercased input equals any of the subject's meanings, lowercased. Each question shows the characters large, a "Meaning" or "Reading" label, and the subject type badge. On a wrong answer the field turns red and the accepted answers show below it. The soft keyboard's submit key submits, and a second press moves to the next question in the queue. When the queue is empty, a "Done, N items" card with a Home button replaces the question (N = items completed).
- **AC-11**: Leaving a lesson quiz or review session after at least one answer (Android back button or the app bar arrow) asks for confirmation with `ConfirmDialog`. Items already completed stay saved; half done items are dropped and nothing else is written. The guard stays off once you confirm or the session is done, and the lesson pages before the quiz are not guarded.
- **AC-12**: Home shows the total number of stage 0 items (lessons) and the due review count, each with a Start button that is disabled at 0. The counts refresh whenever Home regains focus.
- **AC-13**: `/dev/clock` is reachable when `__DEV__` is true or `EXPO_PUBLIC_E2E` is `"1"`, and adds hours to the clock offset (saved in `app_meta.clock_offset_ms`, loaded at startup). In any other build it redirects to `/`. `src/lib/clock` is the only code that reads the device clock.
- **AC-14**: A Vitest loop test runs in `npm test`: fresh in memory database with migrations, a small fixture bundle, startup, one lesson batch completed through the study services, `now` advanced 4 hours, every review answered correctly; every item ends at stage 2 with one `reviews` row each.
- **AC-15**: `maestro/core-loop.yaml` exists: fresh install, do the lesson batch, add 4 hours on the debug clock, answer every review correctly, check Home shows 0 reviews, add 8 hours, check Home shows the batch size again (proving the stage 2 interval). Its first run is listed under the scope's Release build checks, on the `e2e` APK.

## Decision

**Chosen option**: Option 2: services first, loop proven in Vitest, JSON dictionaries.

Build the real pipeline and real pure modules, narrow in breadth, with no mocks or placeholder content, and keep every database touching step in `src/lib/study` and `src/lib/content` so one Vitest test drives the whole loop.

**Implementation skills**: `expo-router` (`expo/skills`, `.agents/skills/expo-router/`) for the stack screens and `beforeRemove` handling · `vercel-react-native-skills` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-native-skills/`) and `react-native-best-practices` (`callstackincubator/agent-skills`, `.agents/skills/react-native-best-practices/`) for the input and list screens · `limrun-maestro-testing` (`limrun-inc/skills`, `.agents/skills/limrun-maestro-testing/`) for the flow file.

## Feature design

**Data model sketch**: no schema change. This slice reads and writes the 0002 tables as they are:
- `subjects` (content, written only by the reseed through `upsertSubjects`)
- `assignments` (`srs_stage`, `started_at`, `available_at`, `passed_at`, `burned_at`)
- `reviews` (append only)
- `user_settings` (`lesson_batch_size`, `current_level`)
- `app_meta` (`content_version`, `clock_offset_ms`)

One new query: `getSubjectsWithMnemonics(db, ids)` in `src/lib/db/queries/subjects.ts`, because `getLessonQueue` returns summaries without mnemonics.

**State transitions** (assignment `srs_stage`):
- absent → 0: the first launch unlock (`insertAssignmentsIfMissing`)
- 0 → 1: the lesson quiz completes the item (`completeLesson`)
- 1..8 → 1..9: a review completes (`applyReview`; up 1 when there are no wrong answers, else the 0001 §6.3 penalty, floor 1). Stage 9 sets `available_at` to null and `burned_at` to now.

**Pipeline** (`pipeline/src/`, run with `tsx`):
- `download.ts`: fetches the latest jmdict-simplified release assets (`jmdict-eng`, `kanjidic2-en`, `kradfile`) and the tanos lists; records url, date, sha256, and license in `SOURCES.json`; supports `--force`.
- `parse/jmdict.ts`, `parse/kanjidic.ts`, `parse/kradfile.ts`, `parse/jlpt.ts`: return typed objects. Each has a Vitest test on a small fixture in `pipeline/fixtures/`.
- `select.ts` and `levels.ts`: 0001 §5.2 and §5.3 (ordering, radical and vocab placement, id assignment that keeps existing ids), writing `content/subjects.json` and printing the report.
- `bundle.ts`: merges subjects with mnemonics for enabled levels (the radical `name` becomes its primary meaning), runs the two AC-4 checks, and writes `bundle.json` and `content-version.txt`.
- `sources.ts`: the pinned jmdict-simplified release tag and asset names, the tanos URLs, and the `tanosLicense` decision (AC-2).
- New npm scripts: `pipeline:download`, `pipeline:build`, `pipeline:bundle`.

**Content rules** (applied by the pipeline, so the app only reads the result):
- **Kanji readings**: strip the okurigana part of a kun'yomi (everything from `.` onward, so `あ.げる` becomes `あ`), drop `-` markers, convert to hiragana, and remove duplicates. The primary kind is on'yomi when the kanji has any on'yomi, else kun'yomi; every reading of the primary kind gets `primary: true`. The lesson page shows all readings, with the primary ones marked.
- **Vocab readings**: the reading that matched the JMdict entry (0001 §5.2) is `primary: true`; other readings of that entry are kept with `primary: false`.
- **Meanings**: kanji and vocab use the first meaning as `primary: true`; `checkMeaning` accepts every meaning.
- **Bundle shape**: `content/bundle.json` is `{ subjects: BundleSubject[] }`, where `BundleSubject` (defined in `src/lib/content/types.ts`) has the same fields as `NewSubject`. A radical maps to `meanings: [{ text: name, primary: true }]`, `readings: []`, `readingMnemonic: null`, `jlpt: null`, `frequency: null`. `jlpt` comes from the tanos list (or the fallback) and `frequency` from KANJIDIC2.
- **Mnemonic check** (AC-4): a kanji passes when every one of its radical names, lowercased, appears as a substring of its lowercased `meaningMnemonic`. `bundle.ts` prints each failing subject with the missing radical name.
- **Components with no Noto Sans JP glyph**: kept in this slice and listed in the build report; substitutes are decided in 0005.

**Pure modules**:
```ts
// src/lib/srs/config.ts: STAGES and INTERVAL_MS from 0001 §6.1, PASSED_STAGE = 5, BURNED_STAGE = 9
// src/lib/srs/schedule.ts
nextAvailableAt(stage: number, now: Date): Date | null            // rounded down to the hour; null at 9
completeLesson(a: Assignment, now: Date): AssignmentPatch
applyReview(a: Assignment, wrongMeaning: number, wrongReading: number, now: Date):
  { patch: AssignmentPatch; review: Omit<NewReview, "id" | "userId"> }
// src/lib/answer/check.ts
checkMeaning(input: string, subject: { meanings: Meaning[] }): "correct" | "wrong"
checkReading(input: string, subject: { readings: Reading[] }): "correct" | "wrong"
// src/lib/study/queue.ts (pure session state, in memory only)
createQueue(items: QueueItem[], random: () => number): QueueState
answerCurrent(state: QueueState, correct: boolean): { state: QueueState; completed?: CompletedItem }
dropItem(state: QueueState, subjectId: number): QueueState
```
A `QueueItem` is `{ subjectId, questions: ("meaning" | "reading")[] }`. A `CompletedItem` is `{ subjectId, wrongMeaning, wrongReading }`. A wrong answer adds 1 to that item's count for the question type and moves the question to the end of the queue. `answerCurrent` returns `completed` the moment an item's last question is answered correctly.

**SRS math** (copied from 0001 §6.1 and §6.3 so the build does not depend on 0001):
- Intervals by stage 1 to 8: 4 h, 8 h, 1 day, 2 days, 7 days, 14 days, 30 days, 120 days. Stage 9 has none.
- `nextAvailableAt(stage, now)` = `floor((now + interval) / 3_600_000) * 3_600_000` (epoch hour, no time zone logic), or null at stage 9.
- With `wrong = wrongMeaning + wrongReading`: when `wrong == 0`, `new = min(9, stage + 1)`; otherwise `penalty = stage >= 5 ? 2 : 1` and `new = max(1, stage - ceil(wrong / 2) * penalty)`.
- `passedAt` is set to now only when `new >= 5` and `a.passedAt` is null. `burnedAt` is set to now and `availableAt` to null when `new == 9`.
- `review` = `{ subjectId, createdAt: now, startingStage: stage, endingStage: new, incorrectMeaningCount, incorrectReadingCount }`.

**Clock** (`src/lib/clock/index.ts`): `now(): Date` returns `Date.now()` plus an in memory offset. `CLOCK_DEBUG_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_E2E === "1"`. `loadClockOffset(db)` runs at startup only when that flag is true, and `setClockOffset(db, ms)` writes `app_meta.clock_offset_ms` and updates the memory value.

**Services** (`src/lib/study/`, `src/lib/content/`): every function takes `db` first and `now: Date` as a parameter, and never reads the clock.

| Function | Inputs | Output | Key errors |
|---|---|---|---|
| `runStartup(db, userId, content, now)` (`src/lib/content/startup.ts`) | `content = { bundle, version }` | `{ reseeded: boolean }` | throws on a DB failure, and the root layout shows the startup error screen |
| `loadLessonBatch(db, userId)` | | items with subject, mnemonics, components | |
| `completeLessonItem(db, userId, subjectId, now)` | | `{ ok }` | `not_pending` (no stage 0 assignment) |
| `loadReviewSession(db, userId, now)` | | due items with subjects | |
| `submitReview(db, userId, input, now, newId)` | `{ subjectId, wrongMeaning, wrongReading }` | `{ ok, newStage }` | `not_found`, `not_due` |
| `getHomeCounts(db, userId, now)` | | `{ lessons, reviews }` | |

**Screens** (Expo Router, stack screens over the tabs with the `AppBar` header):
- `src/app/lessons.tsx`: the item pager, then the quiz.
- `src/app/reviews.tsx`: the review session, with the remaining count in the header.
- `src/app/dev/clock.tsx`: +1 hour, +4 hours, +8 hours, +1 day, and reset buttons, plus the current `now()`.
- `src/app/(tabs)/index.tsx`: the Lessons and Reviews cards replace the Welcome card. The developer card gains a Debug clock link.
- One shared `AnswerInput` component in `src/components/study/` (the reading mode applies `toKana`).
- `testID`s on the Start buttons, the answer input, and the counts, for Maestro.
- Leave guard: `navigation.addListener("beforeRemove")` plus `ConfirmDialog` once any answer is in. A `leaveAllowed` ref, set to true when you confirm or the session is done, turns the guard off so the final navigation does not ask again.
- When a service returns an error (AC-9), the screen shows a toast and calls `dropItem` for that subject.

**Startup** (`src/app/_layout.tsx`): after `useDbMigrations` is ready, call `loadClockOffset` (when enabled) and then `runStartup` with the bundled content while the splash stays up. Any failure shows the existing `StartupError` screen.

`runStartup` details:
- The bundled version is the trimmed text of `content-version.txt`.
- First launch means there is no `user_settings` row for the user. This is checked before any write.
- In one `withTransaction`, when the version differs or this is the first launch: upsert the bundle subjects; on first launch, create the settings (`getOrCreateSettings`) and insert the unlock set with `srsStage: 0` and `unlockedAt: now`, leaving the other timestamps null; then write `content_version`.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| startup | bundled version | `content/content-version.txt` (inline imported) |
| startup | stored version | `app_meta.content_version` |
| startup | first launch unlock set | `subjects` where level 1 and (type radical, or kanji with empty `component_ids`) |
| lesson batch | batch size | `user_settings.lesson_batch_size` (`getOrCreateSettings`) |
| lesson batch | items and order | `getLessonQueue` (level, type order, position) |
| lesson batch | component characters and meanings | `getSubjectsByIds(subject.componentIds)` |
| lesson batch | mnemonics | `getSubjectsWithMnemonics` |
| lesson complete | `started_at`, `available_at` | `completeLesson(a, now())` → `nextAvailableAt(1, now)` |
| review complete | wrong counts | `CompletedItem` from the in memory queue |
| review complete | new stage, `available_at`, `passed_at`, `burned_at` | `applyReview` |
| review complete | review id | `newId()` (`expo-crypto` `randomUUID`) |
| review complete | `created_at` | `now()` at submit |
| review header | remaining items | `QueueState` (items not yet completed) |
| session end | "Done, N items" | count of `completed` results in this session |
| wrong answer | accepted answers | subject `meanings` (all) or `readings` (primary only) |
| home | lesson and review counts | `countLessons`, `countDue(db, userId, now())` |
| any | `now` | `src/lib/clock` `now()` |
| any | user id | `getCurrentUserId()` |

**Key invariants**:
- Only `src/lib/clock` reads the device clock. `src/lib/srs`, `src/lib/answer`, and `src/lib/study/queue.ts` stay pure.
- Each completed lesson item and each completed review is its own `withTransaction`; a crash loses at most the item in progress.
- The lesson quiz never writes `reviews`. Only the reseed writes `subjects`.
- `submitReview` checks the assignment is due as of `now` inside the transaction before it writes.

**Security model**: single local user (`getCurrentUserId()`). The debug clock exists only in development and `e2e` builds; the `preview` APK redirects it, like `/dev/ui`.

**Configuration required**:
- `EXPO_PUBLIC_E2E`: `"1"` only in the `e2e` EAS profile (already in `eas.json`); it enables the debug clock outside development.
- `HTTPS_PROXY` (optional, pipeline only): routes `pipeline:download` through the corporate proxy.

**Critical test scenarios**:
- Happy path: the Vitest loop in AC-14, verifies **AC-5**, **AC-7**, **AC-8**, **AC-14**
- Failure case: `submitReview` for a subject not yet due returns `not_due` and leaves `assignments` and `reviews` unchanged, verifies **AC-9**
- Reseed: running startup twice with the same version leaves rows untouched; a new version updates subjects and keeps progress, verifies **AC-5**
- Unit: `applyReview` from stages 1, 4, 5, and 8 with 0, 1, 2, and 3 wrong answers; hour rounding; `passed_at` set once; stage 9 burn, verifies **AC-7**, **AC-8**
- Unit: the queue moves wrong questions to the end, counts every wrong submission, completes an item only when all its questions are right, and `dropItem` removes an item's remaining questions, verifies **AC-7**, **AC-8**, **AC-9**
- Pipeline: kanji reading normalisation (`あ.げる` becomes `あ`, on'yomi primary when present), verifies **AC-3**, **AC-10**
- Unit: `checkMeaning` with case and spaces; `checkReading` against primary versus non primary readings, verifies **AC-10**
- Pipeline: level builder ordering and placement on a fixture; ids kept across two builds; bundle refuses a missing mnemonic, verifies **AC-3**, **AC-4**

## Build plan

Ordered as a tracer bullet: content first reaches the phone, then the logic, then the screens.

1. [x] Add the `tsx` and `undici` dev dependencies and the `pipeline:download` script. Check the tanos license and record it, falling back to KANJIDIC2 old JLPT levels if the lists are unusable, satisfies **AC-1**, **AC-2**
2. [x] Write the fixture tested parsers, `select.ts`, `levels.ts`, and `pipeline:build` with the report, satisfies **AC-3**
3. [x] Write original level 1 radical names, then kanji and vocab mnemonics, into `content/mnemonics/*.json`; set `enabled-levels.json` to `[1]`; add `pipeline:bundle` with its two checks, satisfies **AC-4**
4. [x] Add `.txt` inline import (Babel and Metro), `getSubjectsWithMnemonics`, and `src/lib/content/startup.ts`, wired into `_layout.tsx`, with Vitest for reseed and first launch unlock, satisfies **AC-5**
5. [x] Add `src/lib/clock` and the `/dev/clock` screen, satisfies **AC-13**
6. [x] Add `src/lib/srs/config.ts` and `schedule.ts`, `src/lib/answer/check.ts`, and `src/lib/study/queue.ts`, with Vitest, satisfies **AC-7**, **AC-8**, **AC-10**
7. [x] Add the `src/lib/study` services and the Vitest loop test, satisfies **AC-7**, **AC-8**, **AC-9**, **AC-14**
8. [x] Install `wanakana` and `expo-crypto` (with `npx expo install`); add `AnswerInput` and the `/lessons` screen (pager, quiz, leave guard), satisfies **AC-6**, **AC-7**, **AC-10**, **AC-11**
9. [x] Add the `/reviews` screen (session, header count, error toast, leave guard), satisfies **AC-8**, **AC-9**, **AC-10**, **AC-11**
10. [x] Add the Home lesson and review cards with focus refresh, and the debug clock link, satisfies **AC-12**
11. [x] Add `testID`s and `maestro/core-loop.yaml`; add its first run to the scope's Release build checks, satisfies **AC-15**

## Consequences

**Positive**:
- Pipeline, bundle, database, SRS, and UI connect in one slice, and the loop is guarded by `npm test` on every commit.
- Screens stay thin; 0006 (unlocks, wrap up) and 0007 (forgiving answers) extend services and pure modules, not screens.

**Negative / tradeoffs**:
- Nothing drives the real UI automatically until the release build; on device behaviour is checked by hand in Expo Go until then.
- Only level 1 is playable, and nothing unlocks beyond the first launch set until 0006 adds `computeUnlocks`.
- Answers are exact: a meaning typo or katakana reading is marked wrong until 0007.
- The review session loads every due item with no cap, so a long absence means one long session; wrap up and any cap come with 0006.
- jmdict-simplified is a third party repackaging; its release asset names can change, and `download.ts` must fail clearly when they do.
- `pipeline/raw` holds large files (tens of MB); it is gitignored.

**Neutral**:
- New dependencies: `wanakana` and `expo-crypto` (app); `tsx` and `undici` (dev).
- The level builder already computes every level; 0005 adds the full validator, the batch workflow, and levels 2 and 3.

## Follow-up

- [ ] 0001 §5.1: add jmdict-simplified (EDRDG derived, CC BY-SA 4.0) as the delivery format for JMdict, KANJIDIC2, and kradfile, so the Credits page (0010) lists it.
- [ ] 0001 §5.4 and spec 0005 say Bob writes mnemonics; the owner moved all development to Claude Code on 2026-11-02. Update both when 0005 is revised.
- [ ] Spec 0005 AC-8 still names `db:seed`; it should name the bundle step and the launch reseed.
- [ ] 0001 AC-4 and §10 expect the core loop proven by Maestro; that run now happens at release (scope Release build checks).
- [ ] Root `AGENTS.md` still points to `.bob/skills/` and has no `pipeline:bundle` command (`/sync`).
