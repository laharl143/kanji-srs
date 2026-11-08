# Verify: Dashboard · spec 0008 · updated 2026-11-08
_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run on the emulator in Expo Go (see `docs/references/android-emulator.md`). Set density and font scale before opening the app, and reset both when done.

## UI / manual
- [x] Open Home with lessons and reviews waiting → the Lessons and Reviews cards still sit at the top with their counts, and `home-start-lessons` / `home-start-reviews` work → AC-1
- [x] With nothing due (debug clock back to now after finishing reviews) → the Reviews count is 0 and Start reviews is disabled → AC-1
- [x] Below the Reviews card, `home-forecast` lists one row per local hour with reviews: hour label, `+N`, running total. The first total is the Reviews count plus that row's `+N`; each next total adds its `+N` → AC-2
- [x] Hours with no reviews do not appear; with no reviews in the window the card reads "No reviews in the next 24 hours." → AC-2
- [ ] Row labels: the current hour reads "This hour", hours after midnight read "Tomorrow 9 AM" style; the screen dump reads each row as one label such as "Tomorrow at 9 AM, 2 more reviews, 44 total" → AC-2
- [x] Move the debug clock forward a few hours, go back to Home → the Reviews count goes up and the forecast rows shift by the same amount (Home reloads on focus and uses the debug clock) → AC-2, AC-5
- [x] `home-level` shows "Level N" (N = Settings current level) with Radicals, Kanji, Vocabulary bars in blue, pink, purple; the kanji bar has a tick at 90% → AC-3
- [x] The "N more kanji to level up" line equals `ceil(kanji total × 0.9) − kanji passed` (for example 4 of 25 → 19); the Vocabulary label says it does not count toward level up → AC-3
- [ ] Use the progress shortcut on `/dev/clock` and pass reviews until one kanji short of 90% → the line says "1 more kanji"; passing one more levels you up and the card shows the next level → AC-3
- [ ] At the highest bundled level, the "more kanji" line is hidden → AC-3
- [ ] `home-stages` shows five tiles (Seed, Sprout, Bloom, Harvest, Retired) in the stage colors, 3 on top and 2 below, zeros shown; counts match the Levels screen's items by stage, and lesson (stage 0) items are not counted → AC-4
- [x] Each tile reads as one label in the screen dump, for example "Seed, 32 items" → AC-4
- [x] At 360dp (`adb shell wm density 480`) and font scale 1.3, in light and dark (`adb shell cmd uimode night yes`), every card fits with no clipped or overlapping text and tile text stays readable → AC-5
- [x] Force a load failure (for example, temporarily throw in `getDashboard`) → one card "Dashboard could not load" with the message and "Try again" (`home-retry`); removing the throw and tapping Try again loads the dashboard → AC-5

## Commands
- [x] `npx vitest run src/lib/srs/forecast.test.ts` → passes: 10:59 goes in the 10:00 bucket, empty hours skipped, running total starts from reviews now, exactly 24h out is excluded → AC-2
- [x] `npx vitest run src/lib/srs/progression.test.ts` → `kanjiToLevelUp` agrees with `checkLevelUp` at every passed count, and is null at the highest level → AC-3
- [x] `npx vitest run src/lib/study/dashboard.test.ts` → seeded counts, forecast, level progress with vocab, stage groups, and per user isolation all pass → AC-1, AC-3, AC-4, AC-5
- [x] `npx vitest run src/components/home src/theme` → row labels, group labels, and the stage tile contrast pairs pass → AC-2, AC-4, AC-5
- [x] `npm run typecheck` and `npm test` → clean → all

## Value sourcing checks
- [x] Reviews card and forecast start share one `countDue`: a review due exactly at now is counted once (in Reviews), not again in the forecast
- [x] Hour bucket uses the device time zone: change the emulator time zone (Settings, Date and time) and the hour labels move with it while the counts stay the same
- [x] Current level comes from `user_settings.current_level`: after a level up the card title changes on the next visit to Home
- [x] Stage groups come only from `stageGroup()` (`src/theme/stage.ts`); no other mapping exists (`grep -rn "srsStage <=" src` finds none outside it)

## Acceptance-criteria coverage
- AC-1 … Lessons and Reviews card steps, dashboard service test
- AC-2 … forecast UI steps, debug clock step, forecast test, row label test
- AC-3 … Level card steps, kanjiToLevelUp test
- AC-4 … Stages tile steps, dashboard service test, group label test
- AC-5 … focus reload, 360dp and 1.3 pass in light and dark, error card step, contrast test
