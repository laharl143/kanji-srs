# src/lib/study

The lesson and review services and the in memory session queue: everything the study screens do with the database. Governing spec: [0004 core study loop](../../../docs/specs/0004-core-loop/index.md). Later slices extend these (0006 unlocks and wrap up, 0007 forgiving answers) rather than the screens.

## Files

- `queue.ts`: pure session state. `createQueue(items, random)` shuffles every question together; `answerCurrent` moves a wrong question to the end and counts it, and returns `completed` the moment an item's last question is right; `dropItem` removes an item after a failed write.
- `lessons.ts`: `loadLessonBatch` (stage 0 items with mnemonics and components) and `completeLessonItem` (stage 0 to 1).
- `reviews.ts`: `loadReviewSession` (every due item) and `submitReview` (checks it is still due, then updates the assignment and appends one `reviews` row).
- `home.ts`: `getHomeCounts`.
- `result.ts`: the `ServiceResult` type.
- `loop.test.ts`: the end to end loop test (lesson, 4 hours, review, stage 2) on `better-sqlite3`. Keep it passing; it is the slice's main guard.

## Related modules

- `../srs/`: stage table (`config.ts`) and the pure schedule math (`schedule.ts`).
- `../answer/`: exact `checkMeaning` / `checkReading`, and `kana.ts` for romaji to hiragana.
- `../clock/`: `now()` plus the debug offset. The only code that reads the device clock.
- `../content/`: `runStartup` (the launch reseed and first launch unlock) and the bundled content import.

## Rules

- Every service takes `db` first and `now: Date` as a parameter; never read the clock here. Screens pass `now()` from `@/lib/clock`.
- Each completed lesson item and each completed review is its own `withTransaction`.
- Services return `{ ok: false, error: "not_due" | "not_found" | "not_pending" }` instead of throwing; a throw means a DB failure.
- Review ids come from an injected `newId` (the app passes `expo-crypto` `randomUUID`, tests pass Node's).
- `queue.ts`, `srs`, and `answer` stay pure (root ground rule 5): inject `random` and `now`.

_Drafted by /sync from the introducing change, worth a quick human pass._
