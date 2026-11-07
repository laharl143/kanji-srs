# 0006. SRS progression: unlocks, level up, wrap up, and session summary

**Date**: 2026-10-13 (updated 2026-11-07 for Expo Android)
**Status**: Accepted

## Summary

This makes the course move forward on its own. A kanji unlocks once all its radicals reach stage 5 (Sprout 1), a word unlocks once all its kanji do, and you level up when 90% of your level's kanji are there. Reviews now run 10 items at a time, with a Wrap up button and an end of session summary that shows what moved and when a new level opens. The 2026-11-07 update replaces the old Next.js server routine with pure functions (plain code that never touches the database) plus one service that runs on every launch and inside each review's database transaction, so a review and its unlocks save together or not at all.

Decision record (context, options, rationale): [rationale.md](rationale.md).

## Requirements

**User stories**:
- As a learner, I want new kanji and words to unlock as soon as I know their parts, so that I always have the next thing to learn.
- As a learner, I want to level up when I know most of my level's kanji, so that the course keeps moving without me managing it.
- As a learner on a phone, I want to stop a big pile of reviews at any point without losing answers, so that short sessions still count.
- As the builder, I want to see a level up on the emulator in minutes, so that this feature can be checked by hand before the release build.

**Acceptance criteria**:
- **AC-1**: `computeUnlocks(subjects, assignments, currentLevel, now)` (pure, in `src/lib/srs/progression.ts`) returns one row `{ subjectId, srsStage: 0, unlockedAt: now.getTime() }` for every subject that has no assignment yet, whose `level <= currentLevel`, and whose every component id has an assignment at stage 5 or higher. A subject with no components (every radical) qualifies as soon as its level is reached. A component with no assignment, or with no subject row, counts as not passed. Rows come back sorted by subject id.
- **AC-2**: `checkLevelUp(subjects, assignments, currentLevel)` returns `currentLevel + 1` when `passed * 10 >= total * 9` and `currentLevel` is below the highest level in `subjects`; otherwise null. `total` counts the kanji at `currentLevel`, and `passed` counts those at stage 5 or higher right now. So 23 of 25 levels up, 22 of 25 does not, 9 of 10 does, and a level with no kanji passes at once.
- **AC-3**: `planProgression({ subjects, assignments, currentLevel, now })` repeats `checkLevelUp` until it returns null, then returns `{ level, unlocks }` with `unlocks = computeUnlocks(subjects, assignments, level, now)`. So a level up unlocks the new level's radicals plus its kanji whose radicals are all passed, and nothing above the new level. On the shipped content, reaching level 2 with every level 1 radical passed unlocks exactly these level 2 subjects: the 23 level 2 radicals and the kanji 下, 山, 午, and 先. Level 1 words whose kanji just passed can unlock in the same run.
- **AC-4**: `runProgression(tx, userId, now)` (in `src/lib/study/progression.ts`) loads the inputs, calls `planProgression`, inserts the unlocks with `insertAssignmentsIfMissing`, and writes `user_settings.current_level` when it rose. It returns `{ unlocked, newLevel }` (`newLevel` is null when the level did not change) and never opens its own transaction. `submitReview` calls it inside the review's transaction, right after it updates the assignment and appends the `reviews` row, and returns `{ ok: true, startingStage, newStage, unlocked, newLevel }`. If any step throws, the whole review rolls back: nothing is written, and the screen shows the existing "Could not save" toast and drops the item.
- **AC-5**: `runStartup` runs `runProgression` in its own transaction on every launch, after the reseed step. On first launch this is what unlocks the level 1 radicals (35 on the shipped content), replacing the separate first launch insert and `getInitialUnlockIds`. When a new APK adds levels while you sit at the last level with 90% of its kanji passed, that launch levels you up and unlocks the new level. A launch with nothing to unlock writes nothing, and a failure shows the existing startup error screen.
- **AC-6**: A review session loads every due item (no size cap), puts them in a random order (from the injected `random`), and keeps 10 in play (`REVIEW_WINDOW_SIZE`). The questions of the items in play are shuffled together, and a wrong answer still moves its question to the end. An item leaves play at its last right answer, and the next waiting item joins right then, each of its questions placed at a random position among the pending ones (one `random()` draw per question). A failed save after that never brings in another item. The header count shows the items not yet completed (in play plus waiting). The lesson quiz keeps its whole batch in play, as today.
- **AC-7**: While any item is waiting to join, the review screen shows a Wrap up button below the answer button. Wrap up stops new items from joining: the items in play finish as usual, and the header count shows only them. The button then reads Keep going, which fills the window back to 10 at once from the waiting items, placing their questions at random positions after the question on screen; after that, items join as in AC-6. When the last item in play finishes during wrap up, the session ends and the summary shows; items that never joined are untouched and stay due.
- **AC-8**: The review header shows accuracy as a whole percent, rounded down so 100% means no misses, next to the count: questions whose first answer was right, divided by questions answered at least once. It stays hidden until the first answer. A question answered wrong and then right counts as answered but not as right on the first try. Answers to an item that a failed write later drops still count.
- **AC-9**: When a review session ends (no question left and the last save has finished, which the Done card already waits for), a summary replaces the review Done card. It keeps the title "Done, N items" (N = items saved, and "Done, 1 item" for one, as the Done card does today) and the `session-done` and `session-home` test IDs, so `maestro/core-loop.yaml` still passes. Under the title it shows how many items were correct (no wrong answers) and incorrect, and the accuracy; a "Level N is open" banner when a review in this session raised your level (N = the highest `newLevel` returned); "N new lessons unlocked" ("1 new lesson unlocked" for one) when this session's reviews unlocked any (N = the sum of `unlocked`); then two groups, Correct and Incorrect, listing each saved item in the order it finished as a `SubjectChip` with its old and new stage names (for example "Seed 4 → Sprout 1") and an up or down mark that its accessibility label also says. An item whose stage did not change (a wrong answer at Seed 1) shows no mark, and its label says it stayed at that stage. Items dropped by an error are not listed.
- **AC-10**: The summary always offers Home. It adds Start lessons when lessons are waiting and Keep reviewing when reviews are due, each showing its count from `getHomeCounts`, read when the summary opens. If that read fails, the summary shows Home only. Start lessons replaces the screen with `/lessons`; Keep reviewing starts a new review session with what is due now. With 0 items saved, the summary reads "Done, 0 items", says nothing finished this time, and shows the same buttons.
- **AC-11**: In development and `e2e` builds only, `/dev/clock` gains a "Move level N to stage 4" button (N = your current level). It moves every assignment at that level with stage 0 to 4 to stage 4, due now, sets `started_at` to now where it is empty, writes no `reviews` rows, and shows in a toast how many rows it updated (items already at stage 4 count, and are made due now too). Reviewing those items correctly then crosses stage 5 for real, so one session of radicals unlocks their kanji, and one session of kanji opens the next level. Any other build still redirects `/dev/clock` to Home.
- **AC-12**: Lessons keep the 0001 §6.2 order across levels: lowest level first, then radicals, kanji, vocab, then `position`. After a level up, the previous level's waiting vocab come before the new level's radicals. (Built and tested in 0004; this feature proves it still holds after a real level up.)
- **AC-13**: A Vitest progression test in `npm test` drives the real services on a two level fixture: level 1 radicals reviewed up to stage 5 put their kanji in the lesson queue; enough level 1 kanji at stage 5 set `current_level` to 2 and put level 2's radicals in the lesson queue, plus the level 2 kanji whose radicals were already passed; at the top fixture level, passing 90% levels nothing up; and a launch with a new bundle that adds level 3 then levels you up. A second test on the shipped bundle checks that first launch unlocks exactly the level 1 radicals.

## Decision

**Chosen option**: Option 1: a pure progression planner that recomputes everything, run inside each review's transaction and on every launch, plus a 10 item review window.

The unlock and level up rules live in one pure module (`src/lib/srs/progression.ts`) that works from every subject, your assignments, and your level. One service, `runProgression`, loads those, writes the result through the caller's transaction, and is reused by reviews, by launch, and later by 0010's skip ahead and reset. The pure session queue gains the window, wrap up, and accuracy; the review screen gains the header accuracy, the Wrap up button, and the summary.

**Implementation skills**: `expo-router` (`expo/skills`, `.agents/skills/expo-router/`) for the summary's navigation · `vercel-react-native-skills` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-native-skills/`) and `react-native-best-practices` (`callstackincubator/agent-skills`, `.agents/skills/react-native-best-practices/`) for the summary list and the quiz screen's per answer renders.

## Feature design

**Data model sketch**: no schema change and no migration. What this feature reads and writes:

| Table or state | Access | Columns | Notes |
|---|---|---|---|
| `subjects` | read | `id`, `type`, `level`, `component_ids` | every row, through `getUnlockInputs(db)` (its `maxLevel` filter becomes optional) |
| `assignments` | read, insert, dev update | all | unlocks insert stage 0 rows (`unlocked_at` = now, other times null) through `insertAssignmentsIfMissing`; the dev shortcut updates stage 0 to 4 rows |
| `user_settings` | read, update | `current_level` | raised by level up, never lowered here |
| `reviews` | insert (unchanged) | all | one row per completed review, as in 0004 |
| session state | memory only | queue, wrap up flag, accuracy counts, saved results | gone when the screen closes, by design (0001 Follow-up) |

Query changes in `src/lib/db/queries/`: `getUnlockInputs(db, maxLevel?)` (no level filter when `maxLevel` is left out); new `promoteLevelForTesting(db, userId, level, now)` in `assignments.ts`, returning how many rows moved; remove `getInitialUnlockIds` from `subjects.ts` (no caller is left).

**State transitions**:
- Assignment: absent → 0 (unlock, `runProgression`) → 1 (lesson) → 1 to 9 (reviews, `applyReview`, unchanged). Dev builds only: 0 to 4 → 4, due now.
- `current_level`: N → N + 1, repeated while `checkLevelUp` allows, inside `runProgression`; never past the highest level in `subjects`. Only 0010's reset sets it back to 1.
- Review session: in play ⇄ wrapping up (Wrap up, Keep going) → summary. Leaving early through the leave guard shows no summary and drops half done items, as in 0004.

**Pure modules**:
```ts
// src/lib/srs/progression.ts
type ProgressionSubject = { id: number; type: SubjectType; level: number; componentIds: number[] };
type ProgressionAssignment = { subjectId: number; srsStage: number };
type UnlockRow = { subjectId: number; srsStage: 0; unlockedAt: number };
computeUnlocks(subjects: readonly ProgressionSubject[], assignments: readonly ProgressionAssignment[],
  currentLevel: number, now: Date): UnlockRow[]
checkLevelUp(subjects: readonly ProgressionSubject[], assignments: readonly ProgressionAssignment[],
  currentLevel: number): number | null
planProgression(input: { subjects; assignments; currentLevel: number; now: Date }):
  { level: number; unlocks: UnlockRow[] }

// src/lib/study/queue.ts (pure session state, in memory only)
export const REVIEW_WINDOW_SIZE = 10;
createQueue(items: QueueItem[], random: () => number, options?: { windowSize?: number }): QueueState
  // items join in a random order; windowSize defaults to every item (the lesson quiz)
answerCurrent(state, correct): { state; completed?: CompletedItem }  // also records first try accuracy
dropItem(state, subjectId): QueueState                              // never brings in another item
setWrapUp(state, on: boolean): QueueState                           // off again refills the window to 10
remainingItems(state): number   // in play plus waiting; in play only while wrapping up
waitingCount(state): number
accuracy(state): number | null  // null before the first answer
```
`QueueState` keeps the injected `random` so joins stay deterministic in tests. A question is keyed by subject id and kind; it counts as answered the first time it is submitted, and as right on the first try only when that first submission was correct.

**API surface** (functions; there are no HTTP endpoints and no auth column, since one local user owns all data; `promoteCurrentLevel` is reachable only from `/dev/clock`):

| Function | Where | Key inputs | Key outputs | Key errors |
|---|---|---|---|---|
| `computeUnlocks`, `checkLevelUp`, `planProgression` | `src/lib/srs/progression.ts` (pure) | as above | unlock rows, next level, `{ level, unlocks }` | none |
| `runProgression` | `src/lib/study/progression.ts` | `tx`, userId, now | `{ unlocked, newLevel }` | throws on a DB failure or missing settings, so the caller's transaction rolls back |
| `submitReview` (changed) | `src/lib/study/reviews.ts` | db, userId, `CompletedItem`, now, newId | `{ ok, startingStage, newStage, unlocked, newLevel }` | `not_found`, `not_due`; a throw rolls the review back |
| `runStartup` (changed) | `src/lib/content/startup.ts` | db, userId, content, now | `{ reseeded }` (unchanged) | throws, and the startup error screen shows |
| `promoteCurrentLevel` | `src/lib/study/dev.ts` | db, userId, now | `{ level, moved }` | throws on a DB failure |
| `getHomeCounts` (reused) | `src/lib/study/home.ts` | db, userId, now | `{ lessons, reviews }` | none |

Screens and components:
- `src/app/reviews.tsx`: creates the session with `windowSize: REVIEW_WINDOW_SIZE`; the header shows accuracy and the count; a Wrap up / Keep going button (`review-wrap-up`) under the answer button, shown while items wait or wrap up is on; on done, `ReviewSummary` instead of `DoneCard`; Keep reviewing loads a fresh session.
- `src/components/study/use-quiz-session.ts`: a `windowSize` option; exposes `accuracy`, `wrappingUp`, `canWrapUp`, `toggleWrapUp`, and `results` (each saved item with its service result). Generic over the save result, so the lesson quiz keeps `{ ok: true }`.
- `src/components/study/HeaderCount.tsx`: optional accuracy (`session-accuracy`); its accessibility label says both numbers.
- `src/components/study/ReviewSummary.tsx` (new): AC-9 and AC-10, with test IDs `session-done`, `session-home`, `summary-level-up`, `summary-new-lessons`, `summary-correct`, `summary-incorrect`, `summary-start-lessons`, `summary-keep-reviewing`.
- `src/app/dev/clock.tsx`: a "Progress shortcut" card with the `dev-promote-level` button.
- `src/app/lessons.tsx`: unchanged apart from the hook's generic type; it keeps `DoneCard`.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| unlock | subject level, type, components | `subjects` through `getUnlockInputs(tx)` |
| unlock | which components are passed | your `assignments.srs_stage >= PASSED_STAGE` (5, `src/lib/srs/config.ts`) |
| unlock | current level | `user_settings.current_level` (`getSettings`) |
| unlock | `unlocked_at` | the `now` passed in: the review's `now()` at submit, or the launch `now()` |
| level up | kanji total and passed at the level | the same loaded subjects and assignments |
| level up | highest level | the largest `level` among the loaded subjects |
| level up | new `current_level` | `planProgression(...).level`, written with `updateSettings` |
| review result | `startingStage` | the assignment read inside `submitReview`'s transaction |
| review result | `newStage` | `applyReview`'s patch, unchanged from 0004 |
| review result | `unlocked`, `newLevel` | `runProgression`'s return |
| review header | items left | `remainingItems(state)` |
| review header | accuracy | `accuracy(state)`, rounded down to a whole percent |
| review session | the items | `loadReviewSession` (every due item, unchanged from 0004) |
| review session | join order and join positions | the injected `random` (`Math.random` in the app, seeded in tests) |
| Wrap up button | shown or not | `waitingCount(state) > 0`, or wrap up is on |
| summary | N in "Done, N items" | the count of saved results |
| summary | correct and incorrect | each saved result's `wrongMeaning + wrongReading` (0 means correct) |
| summary | stage names | `STAGES` in `src/lib/srs/config.ts` |
| summary | old and new stage, up or down mark | each saved result's `startingStage` and `newStage` |
| summary | chip characters, type, meaning | the session's subject summaries (primary meaning) |
| summary | level banner | the highest non null `newLevel` among saved results |
| summary | new lessons | the sum of `unlocked` among saved results |
| summary | Start lessons and Keep reviewing counts | `getHomeCounts(db, userId, now())` when the summary opens |
| dev shortcut | level | `user_settings.current_level` |
| dev shortcut | items moved | assignments of subjects at that level with stage 0 to 4 |
| dev shortcut | `available_at`, `started_at` | `now()` (debug offset included); `started_at` only where it is null |
| any | `now`, user id | `src/lib/clock` `now()`, `getCurrentUserId()` |

**Key invariants**:
- The unlock and level up rules exist only in `src/lib/srs/progression.ts`. Services load and write; nothing else decides.
- Unlocking only inserts (`ON CONFLICT DO NOTHING`). It never changes or deletes an assignment, so it can never reset a stage.
- `current_level` only rises here, and never past the highest level in `subjects`.
- A review, its assignment update, its unlocks, and its level up commit together or not at all.
- `runProgression` always runs on the caller's `tx` and never calls `withTransaction` (nesting throws).
- Items that never joined a session are never written. Wrap up and leaving early write nothing new.
- The dev shortcut writes no `reviews` rows and is reachable only when `CLOCK_DEBUG_ENABLED`.
- `src/lib/srs` and `src/lib/study/queue.ts` stay pure: `now` and `random` are passed in.

**Failure and edge cases**:
- `runProgression` throws during a review: the review rolls back, and the existing toast and drop handle it (0004 AC-9 path).
- It throws at launch: the startup error screen shows, like any startup failure.
- No settings row: it throws (startup always creates the row first).
- At the highest level with content: you stay. A later launch whose bundle adds levels levels you up.
- `current_level` above the highest content level (content shrank): no level up; unlocks still apply up to `current_level`.
- A component id with no subject row: never passed, so the subjects that use it never unlock (the pipeline validator keeps this from shipping).
- A reseed moves a subject to another level: the next launch recomputes; unlocks only add.
- 10 or fewer items due: all are in play, and there is no Wrap up button.
- Wrap up while an item is saving: the save finishes; an item that already joined in its place is in play and finishes too.
- The debug clock moves time forward mid session: the session keeps its loaded items, and Keep reviewing picks up the rest.

**Security model**: single local user (`getCurrentUserId()`); no new permissions or data. The dev shortcut, like the debug clock, exists only in development and `e2e` builds; the `preview` APK redirects `/dev/clock` to Home.

**Configuration required**: none. The window size is the constant `REVIEW_WINDOW_SIZE`.

**Critical test scenarios**:
- Unit: a kanji with two radicals, one passed, stays locked; both passed, it unlocks; a component with no assignment or no subject keeps it locked; a subject above the current level and one already assigned are never returned; a radical unlocks once its level is reached, verifies **AC-1**
- Unit: 22 of 25 stays, 23 of 25 levels up, 9 of 10 levels up, a level with no kanji levels up, and at the highest level nothing happens, verifies **AC-2**
- Unit: `planProgression` from level 1 to 2 returns the level 2 radicals and the level 2 kanji whose radicals are passed, nothing from level 3; a run of kanji free levels stops at the highest level, verifies **AC-3**
- Failure case: a forced throw in `runProgression` during `submitReview` leaves the assignment and `reviews` unchanged, verifies **AC-4**
- Service: the review that crosses the 90% line returns `startingStage`, `unlocked`, and `newLevel`, verifies **AC-4**
- Startup: first launch unlocks exactly the starting set (fixture and shipped bundle); a relaunch writes nothing; a new bundle that adds a level levels up a user waiting at 90%, verifies **AC-5**, **AC-13**
- Queue: 25 items with a seeded `random`: 10 in play and a count of 25; a completion brings in the next item at repeatable positions, and a failed save after it brings in nothing more; a wrong answer still goes to the end, verifies **AC-6**
- Queue: wrap up stops joins and the count drops to the items in play; Keep going fills the window back to 10 with no question placed before the one on screen; finishing during wrap up ends the session with the waiting items unwritten; no Wrap up when nothing waits, verifies **AC-7**
- Queue: accuracy is null before an answer; wrong then right counts once and not as right on the first try; 199 of 200 shows 99%, verifies **AC-8**
- Dev query: only stage 0 to 4 rows at the given level move, a set `started_at` is kept, and no `reviews` rows appear, verifies **AC-11**
- Permission: in a build where `CLOCK_DEBUG_ENABLED` is false (the `preview` APK), `/dev/clock` still redirects to Home, so the shortcut cannot run, verifies **AC-11**
- Loop: the two level progression test, including the lesson order after the level up, verifies **AC-12**, **AC-13**
- By hand in Expo Go on the emulator: the summary title, groups, banner, counts, and buttons in light and dark mode, verifies **AC-9**, **AC-10**

## Build plan

Ordered as a tracer bullet: first one thin unlock thread from the pure rule through the review transaction to the lesson queue, with the dev shortcut right after so every later step can be seen on the emulator; then level up; then the session screen.

1. Unlock thread: `computeUnlocks` with unit tests; `runProgression` writing unlocks only; call it inside `submitReview`'s transaction and on every launch in `runStartup` (remove the first launch insert and `getInitialUnlockIds`); make `getUnlockInputs`'s level filter optional; extend the loop test so radicals reviewed to stage 5 put their kanji in the lesson queue, satisfies **AC-1**, **AC-4**, **AC-5**
2. Dev shortcut: `promoteLevelForTesting` with a query test, `promoteCurrentLevel`, and the `/dev/clock` card; on the emulator, one session of level 1 radicals at stage 4 unlocks the 25 level 1 kanji, satisfies **AC-11**
3. Level up: `checkLevelUp` and `planProgression` with unit tests; `runProgression` writes `current_level` and returns `newLevel`; `submitReview` returns `startingStage`, `unlocked`, and `newLevel`; add the two level progression test and the shipped bundle first launch test, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-12**, **AC-13**
4. Queue window and order: `createQueue` with `windowSize`, random join order and positions, `remainingItems` and `waitingCount`, with tests (the lesson quiz keeps its whole batch in play), satisfies **AC-6**
5. Queue wrap up and accuracy: `setWrapUp` and `accuracy`, with tests, satisfies **AC-7**, **AC-8**
6. Review screen: the `useQuizSession` options and results, the `HeaderCount` accuracy, and the Wrap up / Keep going button, satisfies **AC-6**, **AC-7**, **AC-8**
7. `ReviewSummary` on `/reviews`: title, counts, banner, groups, buttons, the Keep reviewing reload, and Start lessons replacing the screen, satisfies **AC-9**, **AC-10**

## Consequences

**Positive**:
- The course moves through every enabled level on its own, and one rule set covers first launch, reviews, new content waves, and 0010's skip ahead and reset.
- Reviews of any size are safe to stop: at most 10 items are ever half done.
- Level 1 to level 2 can be checked on the emulator in two short sessions instead of days of debug clock.
- The rules are a pure function of stages and level, so a later sync replay of the review log can rebuild unlocks too.

**Negative / tradeoffs**:
- Every review now loads every subject and assignment inside its transaction (about 2,400 rows each once all 25 levels ship), a few tens of milliseconds on a phone. If that ever shows as lag, run it only when the review lifted an item from below stage 5 to 5 or above, the only case where the result can change.
- A bug in the unlock code stops reviews from saving (one transaction) instead of failing quietly; the toast shows it at once.
- Passed means stage 5 right now, so an item that drops back below 5 holds back an unlock or a level up until it climbs again.
- After a level up, the previous level's vocab lessons come before the new level's radicals (0001 §6.2), so the next unlocks wait on those lessons.
- At the last enabled level (3 today) you stay put until feature 12 ships more content. A level up that happens at launch is not announced; the Lessons count shows its unlocks, and the dashboard (feature 9) will show the level.
- The dev shortcut is a second debug only write path that must stay out of release builds.
- The queue state grows (waiting list, wrap up flag, accuracy counts), and the existing shuffle test needs new expected orders.

**Neutral**:
- No schema change, no migration, no new dependency, no new environment variable.
- The first launch unlock moves from the reseed transaction to the progression transaction. The rows are the same, and a crash between the two heals on the next launch.
- The review Done card gives way to the summary; the lesson quiz keeps its Done card. `maestro/core-loop.yaml` keeps passing because the summary keeps the title and test IDs; no new Maestro flow comes with this feature.

## Follow-up

- [ ] Spec 0010 (`/architect settings & credits`): skip ahead and reset should call `runProgression` after their writes for "unlock as at start". Its AC-3 (reset deletes settings and keeps notes) also disagrees with `resetProgress` in 0002 (keeps settings, deletes notes).
- [ ] 0001 §8 asks `/reviews` to expand item details after a wrong answer, and 0009 AC-4 expects that panel, but no spec builds it. Recommended home: 0007 (answer checking), which owns the review feedback UI.
- [ ] 0001 `## Follow-up`: the 0006 items there (unlock eligibility, the level up formula, queue order and cap, accuracy) are settled by this spec; tick them the next time 0001 is edited. The skip ahead rules stay owed to 0010.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
