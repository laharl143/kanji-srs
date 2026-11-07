# Verify: SRS progression · spec 0006 · updated 2026-11-07
_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run the UI steps in Expo Go on the emulator (a development build, so `/dev/clock` is there); see [android-emulator.md](../../references/android-emulator.md). Clear Expo Go's data first for a fresh install: after the 2026-11-07 build check its data sits at level 2 with 95 lessons waiting.

## UI / manual
- [x] Fresh install: Home shows Lessons 35 (the level 1 radicals) and Reviews 0 → AC-5, AC-13
- [x] Home → Debug clock: the Progress shortcut card shows "Move level 1 to stage 4"; press it → toast "Moved 35 level 1 items to stage 4, due now." (items already at stage 4 count too) → AC-11
- [x] Back on Home, Reviews shows 35 and the shortcut wrote no review history (the Reviews count comes from the moved items only) → AC-11
- [x] Start reviews with more than 10 due: the header pill shows "35 left" and no accuracy yet; a Wrap up button sits under the answer button → AC-6, AC-7, AC-8
- [x] Answer the first question wrong and the next two right: the header shows "66% | 33 left"; the missed question comes back later in the session → AC-6, AC-8
- [x] Finish an item: the count drops by one, and never more than 10 items are half done at once → AC-6
- [x] Press Wrap up: the label turns to Keep going, a "Wrapping up" line appears, and the count drops to the items in play (10); press Keep going: the count goes back to in play plus waiting, and the question on screen stays the same → AC-7
- [x] Wrap up again and finish the items in play: the summary replaces the quiz; back on Home, the items that never joined still count as due → AC-7
- [x] Summary title "Done, N items" (N = items saved; "Done, 1 item" for one), with Correct, Incorrect, and Accuracy tiles; accuracy is rounded down (11 of 12 shows 91%) → AC-8, AC-9
- [x] Summary groups: Correct and Incorrect list each saved item in the order it finished, as a chip with its meaning, "Seed 4 → Sprout 1", and an up mark; a missed item shows "Seed 4 → Seed 3" with a down mark; a miss at Seed 1 shows "Seed 1 → Seed 1" and no mark; an empty group says so ("No misses this time.") → AC-9
- [x] "N new lessons unlocked" shows when the session unlocked anything, and N matches Home's Lessons count afterwards → AC-1, AC-4, AC-9
- [x] Summary buttons: Keep reviewing (N) when reviews are still due, Start lessons (N) when lessons wait, Home always (the first one shown is the filled button) → AC-10
- [x] Keep reviewing starts a new session with what is due now (fresh count, no accuracy yet) → AC-10
- [x] Start lessons opens Lessons in place of the summary: pressing Back goes to Home, not back to the summary → AC-10
- [x] With 0 items saved (for example, every save fails): "Done, 0 items", "Nothing finished this time", no tiles or groups, and the same buttons → AC-10
- [x] If the counts cannot be read when the summary opens, it shows Home only → AC-10
- [x] Level up: after the radicals pass, move level 1 to stage 4 again (this moves the kanji lessons) and review them all; the review that passes the 23rd of 25 kanji opens level 2, and the summary shows the "Level 2 is open" banner → AC-2, AC-3, AC-9
- [x] After that level up, the first lesson batch is level 1's waiting kanji and words, and level 2's radicals come after them → AC-12
- [x] The level 2 lessons include its 23 radicals and only the kanji 下, 山, 午, and 先 (the rest wait for level 2 radicals) → AC-3
- [x] A save that fails (for example, a review made not due by another session) shows the toast and drops the item; the summary does not list it, and its answers still count in the accuracy → AC-4, AC-8, AC-9
- [x] Light and dark mode, and 360dp width at 1.3 font scale: header pill, Wrap up button, and the whole summary stay readable with nothing cut off → AC-8, AC-9
- [x] The lesson quiz is unchanged: the whole batch is in play, the pill shows "N left" with no accuracy and no Wrap up, and it ends on the old Done card → AC-6
- [ ] `maestro/core-loop.yaml` still finds "Done, 5 items", `session-done`, and `session-home` on the review summary (run it with the release build checks on the e2e APK) → AC-9

## Commands
- [x] `npm test` → every test passes, including `src/lib/srs/progression.test.ts`, `src/lib/study/progression.test.ts`, `src/lib/study/dev.test.ts`, `src/lib/study/queue.test.ts`, `src/lib/study/summary.test.ts`, and `src/lib/content/startup.test.ts` → AC-1 to AC-13
- [x] `npm run typecheck` and `npm run lint` → clean → AC-1 to AC-13
- [ ] Release build check (preview APK, with the other release checks): `kanjisrs://dev/clock` lands on Home, so the progress shortcut cannot run → AC-11

## Value sourcing
One check per row of the spec's Value sourcing table, each aimed at the edge that breaks if the source is wrong.
- [x] Unlock, subject level, type, components (from `subjects` through `getUnlockInputs`): a level 2 kanji built only from level 1 radicals stays locked until you reach level 2 → AC-1
- [x] Unlock, which components are passed (stage 5 or higher): a kanji stays locked while one of its radicals is at Seed 4, and unlocks in the review that takes that radical to Sprout 1 → AC-1
- [x] Unlock, current level (`user_settings.current_level`): subjects above your level never unlock, however passed their parts are → AC-1
- [x] Unlock, `unlocked_at` (the review's or the launch's `now()`): with a debug clock offset, a new lesson's `unlocked_at` equals the review time including the offset, not the device time → AC-1, AC-4
- [x] Level up, kanji total and passed at the level: 22 of 25 passed keeps you at level 1, 23 of 25 opens level 2 (passed radicals and words do not count) → AC-2
- [x] Level up, highest level (the largest level among the subjects): at level 3, the top shipped level, passing 90% of its kanji levels nothing up → AC-2
- [x] Level up, new `current_level` (`planProgression`, written with `updateSettings`): after the level up, the settings row holds 2 and the dev shortcut button reads "Move level 2 to stage 4" → AC-2, AC-4
- [x] Review result, `startingStage` (the assignment read inside the transaction): the summary's left stage is the stage before this review (Seed 4), not the stage after → AC-4, AC-9
- [x] Review result, `newStage` (`applyReview`): a miss at Seed 4 shows Seed 3, and a miss at Sprout 2 shows Seed 4 (the penalty doubles from stage 5 up) → AC-4, AC-9
- [x] Review result, `unlocked` and `newLevel` (`runProgression`'s return): the review that crosses 90% is the one whose result carries `newLevel` 2 and the level's unlock count → AC-4
- [x] Review header, items left (`remainingItems`): with 35 due it shows 35 at the start, then only the items in play while wrapping up → AC-6, AC-7
- [x] Review header, accuracy (`accuracy`, rounded down): one miss in three answers shows 66%, not 67% → AC-8
- [x] Review session, the items (`loadReviewSession`, every due item): with 35 due the count is 35, not capped at 10 → AC-6
- [x] Review session, join order and positions (the injected `random`): two sessions over the same due items start in different orders (`Math.random` in the app; seeded and repeatable in `queue.test.ts`) → AC-6
- [x] Wrap up button, shown or not (`waitingCount > 0`, or wrap up on): with 10 or fewer due there is no Wrap up button; during wrap up the button stays as Keep going → AC-7
- [x] Summary, N in "Done, N items" (the saved results): a dropped item is not counted → AC-9
- [x] Summary, correct and incorrect (`wrongMeaning + wrongReading`): a kanji missed only on its reading lands in Incorrect → AC-9
- [x] Summary, stage names (`STAGES`): rows show the fine stage names ("Sprout 1"), not the group names ("Sprout") → AC-9
- [x] Summary, old and new stage and the mark (`startingStage`, `newStage`): up mark when the stage rose, down mark when it fell, none when it stayed → AC-9
- [x] Summary, chip characters, type, meaning (the session's subject summaries, primary meaning): a kanji row shows the kanji color and its primary meaning, and the chip opens that item's page → AC-9
- [x] Summary, level banner (the highest `newLevel`): the banner shows only in a session whose review raised the level; a level up at launch shows none → AC-9
- [x] Summary, new lessons (the sum of `unlocked`): the number equals the rise in Home's Lessons count over the session → AC-9
- [x] Summary, button counts (`getHomeCounts` when the summary opens): after a wrap up the Keep reviewing count includes the items that never joined, and it matches Home's Reviews count → AC-10
- [x] Dev shortcut, level (`user_settings.current_level`): the button label and the toast name your current level → AC-11
- [x] Dev shortcut, items moved (stage 0 to 4 at that level): items at Sprout 1 or higher are not touched, and items at other levels are not touched → AC-11
- [x] Dev shortcut, `available_at` and `started_at` (`now()`, debug offset included): with a +1 day offset the moved items are due at once; an item that already had `started_at` keeps it → AC-11
- [x] Any, `now` and user id (`now()` from `src/lib/clock`, `getCurrentUserId()`): every write in these steps follows the debug clock, and all rows belong to the local user → AC-1 to AC-11

## Acceptance-criteria coverage
- AC-1 … the fresh install, unlock, new lessons, and Value sourcing unlock steps; unit tests in `src/lib/srs/progression.test.ts`
- AC-2 … the level up step and the level up Value sourcing steps; unit tests in `src/lib/srs/progression.test.ts`
- AC-3 … the level up and level 2 lessons steps; the shipped content test in `src/lib/srs/progression.test.ts`
- AC-4 … the new lessons, failed save, and review result steps; rollback tests in `src/lib/study/progression.test.ts`
- AC-5 … the fresh install step; launch tests in `src/lib/content/startup.test.ts`
- AC-6 … the window, count, session items, join order, and lesson quiz steps; `src/lib/study/queue.test.ts`
- AC-7 … the Wrap up, Keep going, and wrap up finish steps; `src/lib/study/queue.test.ts`
- AC-8 … the accuracy steps; `src/lib/study/queue.test.ts`
- AC-9 … the summary title, groups, banner, new lessons, and themes steps; `src/lib/study/summary.test.ts`
- AC-10 … the summary buttons, Keep reviewing, Start lessons, 0 items, and counts failure steps
- AC-11 … the Debug clock steps, the release build check, and the dev shortcut Value sourcing steps; `src/lib/study/dev.test.ts`, `src/lib/db/queries/assignments.test.ts`, `src/lib/clock/clock.test.ts`
- AC-12 … the lesson order after the level up; `src/lib/study/progression.test.ts`
- AC-13 … the fresh install step and `npm test`; the two level loop in `src/lib/study/progression.test.ts` and the shipped bundle first launch test in `src/lib/content/startup.test.ts`
