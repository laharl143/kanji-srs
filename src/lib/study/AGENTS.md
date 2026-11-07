# src/lib/study

The lesson and review services and the in memory session queue: everything the study screens do with the database. Governing spec: [0004 core study loop](../../../docs/specs/0004-core-loop/index.md). Later slices extend these ([0006 unlocks, level up, and wrap up](../../../docs/specs/0006-srs-progression/index.md), 0007 forgiving answers) rather than the screens.

## Files

- `queue.ts`: pure session state. `createQueue(items, random, { windowSize })` keeps that many items in play (reviews pass `REVIEW_WINDOW_SIZE`, 10; the lesson quiz leaves it out and keeps its whole batch in play), and waiting items join in a random order at random positions; `answerCurrent` moves a wrong question to the end and counts it, and returns `completed` the moment an item's last question is right; `setWrapUp` stops joins (off again refills the window), `remainingItems` and `waitingCount` drive the header and the Wrap up button, `accuracy` is first try right over answered; `dropItem` removes an item after a failed write and never brings in another.
- `lessons.ts`: `loadLessonBatch` (stage 0 items with mnemonics and components) and `completeLessonItem` (stage 0 to 1).
- `reviews.ts`: `loadReviewSession` (every due item) and `submitReview` (checks it is still due, then updates the assignment, appends one `reviews` row, and runs `runProgression` in the same transaction; returns `startingStage`, `newStage`, `unlocked`, `newLevel`).
- `progression.ts`: `runProgression(tx, userId, now)` loads subjects, assignments, and the level, asks the pure planner in `../srs/progression.ts`, inserts the unlocks, and raises `current_level`. Used by reviews and by launch.
- `summary.ts`: pure data for the review summary: `summarizeReviews`, `stageName` (fine names like "Seed 4", from `STAGES`), `stageChange`, `describeChange` (the row's accessibility label).
- `dev.ts`: `promoteCurrentLevel` and `getCurrentLevel` for the progress shortcut on `/dev/clock`: moves the level's stage 0 to 4 items to stage 4, due now, and writes no `reviews` rows.
- `home.ts`: `getHomeCounts`.
- `result.ts`: the `ServiceResult` type.
- `loop.test.ts`: the end to end loop test (lesson, 4 hours, review, stage 2) on `better-sqlite3`. Keep it passing; it is the slice's main guard.
- `progression.test.ts`: the two level progression loop (0006 AC-12, AC-13) and the review rollback when `runProgression` throws. Keep it passing too.

## Related modules

- `../srs/`: stage table (`config.ts`), the pure schedule math (`schedule.ts`), and the pure unlock and level up rules (`progression.ts`: `computeUnlocks`, `checkLevelUp`, `planProgression`), the only place those rules live.
- `../answer/`: exact `checkMeaning` / `checkReading`, and `kana.ts` for romaji to hiragana.
- `../clock/`: `now()` plus the debug offset. The only code that reads the device clock.
- `../content/`: `runStartup` (the launch reseed when the content version changed, then `runProgression` in its own transaction on every launch, which does the first launch unlock and any launch level up) and the bundled content import.

## Rules

- Every service takes `db` first and `now: Date` as a parameter; never read the clock here. Screens pass `now()` from `@/lib/clock`.
- Each completed lesson item and each completed review is its own `withTransaction`.
- `runProgression` always runs on the caller's `tx` and never calls `withTransaction` (nesting throws), so a review, its unlocks, and its level up commit together or not at all.
- The progress shortcut (`dev.ts`) is reachable only when `CLOCK_DEBUG_ENABLED` (development and `e2e` builds); the `preview` APK redirects `/dev/clock` to Home.
- Services return `{ ok: false, error: "not_due" | "not_found" | "not_pending" }` instead of throwing; a throw means a DB failure.
- Review ids come from an injected `newId` (the app passes `expo-crypto` `randomUUID`, tests pass Node's).
- `queue.ts`, `srs`, and `answer` stay pure (root ground rule 5): inject `random` and `now`.

_Drafted by /sync from the introducing change, worth a quick human pass._
