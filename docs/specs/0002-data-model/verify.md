# Verify: data model · spec 0002 · updated 2026-11-01
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Run `npm run dev` and open the app in Expo Go on the phone → the splash screen hides and the home screen shows → AC-1
- [x] Close the app fully and open it again → no error screen, nothing reapplied (the migration journal already has the entry) → AC-2
- [x] On the home screen, tap "Run rollback check (dev)" → shows "Rollback OK: no row written" → AC-7
- [x] Temporarily add a broken statement to a new migration (or break the SQL in a scratch copy), reload → a blocking "The app could not start" screen shows the error message and no study screen opens; revert afterwards → AC-3

## Commands
- [x] `npm run db:generate` → "No schema changes" (the committed migration matches the schema) → AC-1
- [x] `npm test` → all suites pass, including `tests/unit/db/migrations.test.ts` (tables, keys, indexes, rerun, no foreign keys) → AC-1, AC-2, AC-6
- [x] `npm test` → `tests/unit/db/transaction.test.ts` passes (commit, rollback with the original error, call order, recovery after failure, nested guard) → AC-7
- [x] `npm test` → `src/lib/auth/current-user.test.ts` passes → AC-4
- [x] `npm test` → `src/lib/db/queries/*.test.ts` pass → AC-5, AC-6
- [x] `npm run typecheck` → clean, which includes the `Db` type test for both drivers (`tests/unit/db/types.test.ts`) → AC-5

## Value sourcing
- [x] `insertReview` `id` and `created_at`: the caller supplies both; inserting the same id twice fails (`user-data.test.ts`)
- [x] `upsertNote` `updated_at`: equals the `now` passed in, and changes with each call (`user-data.test.ts`)
- [x] `getOrCreateSettings`: `created_at` is the first `now`; a second call with a later `now` keeps the first value (`user-data.test.ts`)
- [x] `getDueReviews` / `countDue`: vary `now` around an `available_at` boundary; a row exactly at `now` is due, a row 1 ms later is not; stage 0 and 9 rows never appear (`assignments.test.ts`)
- [x] `getDueReviews` order: equal `available_at` sorts by `subject_id` (`assignments.test.ts`)
- [x] `getForecast`: a time equal to `to` is excluded, one equal to `from` is included (`assignments.test.ts`)
- [x] `getLessonQueue` order: radical, kanji, vocab within a level, then `position`, and `limit` caps it (`assignments.test.ts`)
- [x] `getUsedIn`: only subjects whose `component_ids` contain the id (`subjects.test.ts`)
- [x] Counts (`getStageCounts`, `getLevelProgress`, `getLevelSummaries`): stage 4 is not passed, stage 5 is; another user's rows are not counted (`assignments.test.ts`, `subjects.test.ts`)
- [x] `insertAssignmentsIfMissing`: an existing stage 4 row stays at 4 (`assignments.test.ts`)
- [x] `raiseAssignmentsBelowLevel`: a stage 8 row stays at 8 and keeps its times; lower rows rise (`assignments.test.ts`)
- [x] `resetProgress`: `current_level` becomes 1; other settings, other users' rows, and `app_meta` stay (`user-data.test.ts`)
- [x] `upsertNote` fields: left out keeps, `null` clears, `synonyms` replaced whole (`user-data.test.ts`)
- [x] Every progress query takes `userId` from the caller; app code gets it only from `getCurrentUserId()` (grep `src/` for `"local"` outside `src/lib/auth`)
- [x] `upsertSubjects`: changed mnemonics update, no subject is deleted, progress rows unchanged (`migrations.test.ts`, `subjects.test.ts`)

## Acceptance-criteria coverage
- AC-1: Expo Go launch, `db:generate`, `migrations.test.ts`
- AC-2: relaunch, `migrations.test.ts` rerun test
- AC-3: broken migration error screen (phone only)
- AC-4: `current-user.test.ts`
- AC-5: query suites plus the `Db` type test
- AC-6: no foreign keys and reseed safety tests
- AC-7: `transaction.test.ts` plus the dev rollback button
