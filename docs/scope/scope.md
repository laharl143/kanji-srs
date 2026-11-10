# Scope: Kaizen Kanji

A private Android app (Expo, React Native) that teaches Japanese kanji up to JLPT N3 with spaced repetition (radicals, then kanji, then vocabulary), built from free open data and original mnemonics. It is for you, studying on your phone: a sideloaded APK that works fully offline, keeps progress in SQLite on the phone, and sends local review reminders. Desktop and sync come later (see Deferred).

**Heads up (2026-11-01):** spec 0001 moved the app from Next.js web to Expo Android. Specs 0002, 0003, 0004, 0006, 0007, 0009 and 0010 were written for Next.js, so their features carry a `spec stale for Android` tag. Run `/architect <feature>` to update each spec before `/develop` (0001 `## Follow-up` lists what changes).

**Release builds (2026-11-02):** EAS `preview` APK builds wait until the app is feature complete (Free plan: 15 Android builds a month, and each one is slow). Until then, check features in Expo Go. A cold deep link `exp://<host>:<port>/--/<path>` stands in for a release deep link. Checks that only a release build can prove go into **Release build checks** below. Make an early build only if a feature adds a native module or `app.json` plugin, because Expo Go cannot catch those breaking.

**Build approach:** Tracer Bullet (get one thin real thread working through every layer first, then thicken one part at a time).
**Workflow:** Alpha (after `/develop`, run `/check verify` on the real app). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· GA`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | done |
| 2 | Coding standards & tooling | Foundation | done |
| 3 | Data model | Foundation | done |
| 4 | UI foundation | Foundation | done |
| 5 | Core study loop | Slice 1 | done |
| 6 | Full content pipeline | Slice 2 | done |
| 7 | SRS progression | Slice 3 | done |
| 8 | Answer checking | Slice 4 | done |
| 9 | Dashboard | Slice 5 | done |
| 10 | Item pages & level browser | Slice 6 | done |
| 11 | Settings & credits | Slice 7 | done |
| 14 | Review reminders | Slice 8 | done |
| 12 | Mnemonic waves | Slice 9 | done |
| 15 | Kaizen Kanji name & emblem | Slice 10 | done |
| 16 | Quick synonyms in lessons & reviews | Slice 11 | in-progress |
| 17 | Anki mode | Slice 12 | in-progress |
| 13 | Patch Next.js security advisory | Dropped | dropped |

## Foundations

### 1. Stack & architecture · done
Pick the stack and fix the product contract (data model, pipeline, SRS rules, screens), then scaffold a runnable Expo Android project. Reopened 2026-11-01: spec 0001 replaced Next.js with Expo, so the scaffold is redone (pipeline, `content/`, docs, Husky, ESLint, Prettier, and Vitest carry over).
**Done when:** `npm run dev` on Windows starts the Expo dev server and the empty app opens in Expo Go on your Android phone, and a `preview` APK from EAS Build installs and opens (0001 AC-1, AC-6).
History: the first Next.js scaffold was built and verified, then superseded on 2026-11-01.
- [x] Design it (spec, revised 2026-11-01 for Expo): `/architect stack & architecture`
- [x] Build it (re scaffold on Expo from the revised Proposed stack, built 2026-11-01; Expo SDK 58, expo-router, `app.json`, `eas.json`): `/develop stack & architecture`
- [x] Verify it (the Expo scaffold, passed 2026-11-01: preview APK opens offline in airplane mode): `/check verify stack & architecture`
Spec 0001 · code in `/` (root)

### 2. Coding standards & tooling · done
Capture conventions from the real scaffolded project, then install lint, format, strict types, and a pre-commit hook that runs `npm test`.
**Done when:** root `AGENTS.md` reflects the real stack, and lint, format, and tests run clean on commit.
- [x] Capture conventions + tooling choices: `/audit`
- [x] Install the tooling: `/develop tooling`
- [x] Verify it: `/check verify coding standards & tooling`

### 3. Data model · done
Typed schema, migrations, database client, and query layer for content and progress tables, with a user id on every progress row.
**Done when:** migrations create every table in 0001 §4, rerun cleanly, and the query layer passes its tests.
- [x] Design it (spec, update 0002 for Android): `/architect data model`
- [x] Build it (built 2026-11-01): `/develop data model`
   - [x] Drizzle setup, schema, first migration, driver mode confirmed (AC-1, AC-6)
   - [x] Startup migrations, error screen, and `withTransaction` (AC-1, AC-2, AC-3, AC-7) (phone checked in Expo Go 2026-11-01)
   - [x] Current user helper and query modules with tests (AC-4, AC-5, AC-6)
- [x] Verify it (verified 2026-11-01): `/check verify data model`
Spec [0002](../specs/0002-data-model/index.md) · code in `src/lib/db/`, `src/lib/auth/`, `drizzle/`

### 4. UI foundation · done
Pink / blue / purple colorway (see `docs/references/ui-inspiration.md`), Japanese font, bottom tab shell with a pink app bar, and base components, working at phone width and in dark mode.
**Done when:** every base component renders on the development preview screen at 360dp, in light and dark mode and at a 1.3 font scale, reads correctly with TalkBack, and the preview is unreachable in the `preview` APK.
- [x] Design it (spec, updated 2026-11-01 for Android): `/architect UI foundation`
- [x] Build it (built 2026-11-02): `/develop UI foundation`
   - [x] NativeWind thread, tokens, stage colors, Japanese font (AC-1 to AC-3) (built 2026-11-01; checked 2026-11-02: Expo Go on the emulator in light and live dark mode with Japanese glyphs and Bold, and `preview` APK e6487fe5 opens on the phone with no developer card)
   - [x] App shell: tabs, AppBar, Screen, placeholders (AC-4) (built 2026-11-01, phone check pending)
   - [x] Base components, toast, confirm dialog (AC-5, AC-6) (built 2026-11-01, phone check pending)
   - [x] Dev preview screen and on device checks (AC-7) (screen built 2026-11-01; emulator checks passed 2026-11-02 at 360dp, 1.3 font scale, light and dark; on the phone 2026-11-02, TalkBack and keyboard autofocus passed; the `/dev/ui` release redirect now goes to `href="/"` because `/index` resolves to +not-found on a cold deep link, and Expo Go confirmed it on a cold start; the APK proof is in Release build checks)
- [x] Verify it: `/check verify UI foundation` (skipped 2026-11-02, marked done by you: 29 of 37 verify steps passed on the emulator with no failures; still open are TalkBack in this run, the offline splash and splash color, the toast with 3 button navigation, and stage 4 and 6 dots on screen, plus the release build steps in Release build checks)
Spec [0003](../specs/0003-ui-foundation/index.md) · code in `src/global.css`, `src/theme/`, `src/components/ui/`, `src/app/`

## Slice 1: Core study loop

### 5. Core study loop · done
The walking skeleton: real open data becomes level 1, you take a lesson, and a review moves the item up a stage. Narrow, but real in every layer.
**Done when:** on a fresh database you can learn level 1 radicals, review them 4 hours later, and see them reach stage 2, proven by the Vitest loop test in `npm test` and by hand in Expo Go with the debug clock (the Maestro flow first runs at release, see Release build checks).
- [x] Design it (spec, updated 2026-11-02 for Android): `/architect core study loop`
- [x] Build it (built 2026-11-02; the loop also passed by hand in Expo Go on the emulator with the debug clock, light and dark): `/develop core study loop`
   - [x] Download, license check, parse, and build levels (AC-1 to AC-3)
   - [x] Level 1 mnemonics, bundle, and reseed on launch (AC-4, AC-5)
   - [x] Clock, debug clock, SRS math, answer checks, study services, and the Vitest loop test (AC-7 to AC-10, AC-13, AC-14)
   - [x] Lessons, reviews, and Home counts (AC-6 to AC-12)
   - [x] Maestro flow written, run deferred to release (AC-15)
- [x] Verify it: `/check verify core study loop` (skipped 2026-11-02, marked done by you: the full loop passed by hand in Expo Go on the emulator, lessons to stage 1, reviews 4 hours later, stage 2 proven by the 8 hour return, plus the leave guard, the AC-9 toast, and dark mode; not run on a device were reading questions (no kanji unlock until 0006), the real phone keyboard, the clock offset after a restart, and the pipeline refusal commands, which unit tests cover; the steps are in `verify.md`, and the Maestro run is in Release build checks)
Spec [0004](../specs/0004-core-loop/index.md) · code in `pipeline/src/`, `content/`, `src/lib/content/`, `src/lib/clock/`, `src/lib/srs/`, `src/lib/answer/`, `src/lib/study/`, `src/components/study/`, `src/app/lessons.tsx`, `src/app/reviews.tsx`, `src/app/dev/clock.tsx`, `maestro/`

## Slice 2: Full content pipeline

### 6. Full content pipeline · done
Make the pipeline safe to rerun: license check, stable ids, full validation, build report, and the batch workflow for writing mnemonics.
**Done when:** levels 1 to 3 pass validation and are playable, and rebuilding never changes or reuses an id.
- [x] Design it (spec, updated 2026-11-02: Claude Code writes the batches, retired ids, vocab fallback, cross checked): `/architect full content pipeline`
- [x] Build it: `/develop full content pipeline`
   - [x] License check and stable ids (AC-1, AC-2) (built with feature 5 on 2026-11-02: `pipeline/src/sources.ts` records the tanos license, and `pipeline/src/levels.test.ts` proves ids stay stable across two builds)
   - [x] Validator, retired ids, bundle guard, and reseed log (AC-3, AC-6, AC-8, AC-9) (built 2026-11-02)
   - [x] Batch and merge workflow, proven on one level 2 radical batch (AC-5, AC-6) (built 2026-11-02: batch 001 merged the 23 level 2 radical names)
   - [x] Vocab fallback and build report (AC-4, AC-10) (built 2026-11-07: off by default, so the real tanos build stays byte identical; a dry run on the full raw data picks 1,939 common words)
   - [x] Levels 2 and 3 written and enabled (AC-7) (built 2026-11-07: batches 002 to 012 merged, 222 items; `enabled-levels.json` is `[1, 2, 3]` and the bundle holds 357 subjects; the reseed was checked in Expo Go on the emulator, because no screen lists level 2 and 3 items until features 7 and 10)
- [x] Verify it (verified 2026-11-07: all 16 steps in `verify.md` passed, plus live merge and bundle refusals, a vocab fallback dry run on the real raw data, and a reseed from the older level 1 content version to the new one in Expo Go on the emulator): `/check verify full content pipeline`
Spec [0005](../specs/0005-content-pipeline/index.md) · code in `pipeline/src/`, `content/`, `src/lib/content/startup.ts`

## Slice 3: SRS progression

### 7. SRS progression · done
Kanji unlock when their radicals pass, vocab when its kanji pass, level up at 90%, plus wrap up and a session summary.
**Done when:** finishing level 1 radicals unlocks its kanji, passing 90% of level 1 kanji opens level 2, and wrap up works.
- [x] Design it (spec, updated 2026-11-07 for Android: 10 item review window, Keep going after Wrap up, dev shortcut to stage 4): `/architect SRS progression`
- [x] Build it: `/develop SRS progression`
   - [x] Unlock step after each review and on launch, plus the dev shortcut (AC-1, AC-4, AC-5, AC-11) (built 2026-11-07: `runProgression` runs inside each review's transaction and on every launch; in Expo Go on the emulator the `/dev/clock` shortcut moved the 35 level 1 radicals to stage 4)
   - [x] Level up with the content cap and the progression loop test (AC-2, AC-3, AC-12, AC-13) (built 2026-11-07: `src/lib/study/progression.test.ts` drives the two level loop; on the emulator one session of level 1 kanji opened level 2, and the next lessons started with level 1 kanji and words)
   - [x] Review window, wrap up, and accuracy (AC-6 to AC-8) (built 2026-11-07: on the emulator with 35 due, 10 in play, Wrap up and Keep going, and 66% after one miss in three answers)
   - [x] Session summary (AC-9, AC-10) (built 2026-11-07: on the emulator, including the Level 2 is open banner, dark mode, Keep reviewing, and Start lessons)
- [x] Verify it (verified 2026-11-08: all 51 Expo Go steps in `verify.md` passed on the emulator, among them the level 2 unlock in the review of the 23rd kanji, the lesson order after it, 360dp at a 1.3 font scale in light and dark, and a miss at Sprout 2 dropping to Seed 4; the TalkBack step was dropped on your request and the labels stay; the Maestro run and the `/dev/clock` APK check are in Release build checks): `/check verify SRS progression`
Spec [0006](../specs/0006-srs-progression/index.md) · code in `src/lib/srs/progression.ts`, `src/lib/study/`, `src/components/study/ReviewSummary.tsx`, `src/app/reviews.tsx`, `src/app/dev/clock.tsx`

## Slice 4: Answer checking

### 8. Answer checking · done
Forgiving answers: typo tolerance, synonyms, katakana treated as hiragana, and a hint (not a penalty) for the wrong kind of kanji reading.
**Done when:** a small meaning typo is accepted as close, and a kun'yomi typed for an on'yomi question shakes with a hint.
- [x] Design it (spec, update 0007 for Android): `/architect answer checking` (updated 2026-11-08: adds a course word guard, optional brackets and "to", every vocab reading accepted, and synonyms wired now)
- [x] Build it: `/develop answer checking`
   - [x] Reading rules, hint, and shake: kana normalization, every vocab reading, wrong kind, invalid, does not count (AC-4 to AC-8, AC-10, AC-11)
   - [x] Meaning forms, typo tolerance, and close enough (AC-1, AC-2, AC-6, AC-9)
   - [x] Course word guard and synonyms loaded with each session (AC-3, AC-11, AC-12)
   - [x] Reading helper line and the emulator pass (AC-8, AC-9, AC-13)
- [x] Verify it: `/check verify answer checking` (skipped 2026-11-08, marked done by you: every verify step passed on the emulator except the two synonym steps for AC-11 and AC-12, which need feature 10's synonym editor; the load failure step passed in a throwaway worktree)
Spec [0007](../specs/0007-answer-checking/index.md) · code in `src/lib/answer/`, `src/components/study/` (answer state, field, quiz view), `src/lib/study/answers.ts`

## Slice 5: Dashboard

### 9. Dashboard · done
What is waiting now, the next 24 hours of reviews, level progress, and items per stage.
**Done when:** the home page shows all four sections with correct numbers for a seeded user.
- [x] Design it (spec): `/architect dashboard` (updated 2026-11-08 for Android: layout picked from mockups, keep the Lessons and Reviews cards and add Next 24 hours, Level N with radical, kanji, and vocabulary bars, and five stage tiles)
- [x] Build it: `/develop dashboard`
   - [x] Forecast and level up helpers with tests (AC-2, AC-3)
   - [x] `getDashboard` service, Home switched to it, and the Next 24 hours card (AC-1, AC-2, AC-5)
   - [x] Level N and Stages cards (AC-3, AC-4)
   - [x] Emulator pass at 360dp and font scale 1.3, light and dark (AC-5)
- [x] Verify it (verified 2026-11-08: every AC met in Expo Go on the emulator, among them the debug clock shift, the zero state, 360dp at a 1.3 font scale in light and dark, the forced load failure with Try again, and the time zone move; not run on the device were the level up via the progress shortcut, the hidden line at the highest level, and a live "This hour" row, which unit tests cover, and the Levels screen count match, which needs feature 10): `/check verify dashboard`
Spec [0008](../specs/0008-dashboard/index.md) · code in `src/lib/srs/forecast.ts`, `src/lib/study/dashboard.ts`, `src/components/home/`, `src/app/(tabs)/index.tsx`

## Slice 6: Item pages & level browser

### 10. Item pages & level browser · done
A page per item with used in, your notes and synonyms, spoken audio for vocab, and a level browser colored by stage.
**Done when:** a synonym added on an item page is accepted in reviews, and every level shows its items by stage.
- [x] Design it (spec, updated 2026-11-08 for Android: layout picked from mockups, notes and synonyms edited inside the Meaning and Reading cards, Levels tab of level rows under a stage tile row, level grids of type colored tiles with a stage bar, Show details after a wrong answer, speak button on vocab item and lesson pages): `/architect item pages & level browser`
- [x] Build it: `/develop item pages & level browser`
   - [x] Item page with stage strip, next review text, components, and used in (AC-1, AC-2, AC-3, AC-11, AC-12) (built 2026-11-08)
   - [x] Notes and synonyms edited in place (AC-4, AC-5, AC-6) (built 2026-11-08)
   - [x] Notes in lessons and Show details in quizzes (AC-7) (built 2026-11-08)
   - [x] Levels tab and level pages (AC-8, AC-9, AC-11, AC-12) (built 2026-11-08)
   - [x] Speak button and emulator pass at 360dp, font scale 1.3, light and dark (AC-10, AC-12) (speak button built 2026-11-08; emulator pass done 2026-11-08 after the `inlineRem: 16` fix, every control 48dp or more)
- [x] Verify it: `/check verify item pages & level browser` (skipped 2026-11-08, marked done by you: no step failed on the emulator, and AC-12 passed at 360dp and a 1.3 font scale in light and dark after the rem fix; still not run on a device are the Retired label and the time zone step (AC-3), the kana refusal and "huge" in a review (AC-5; a lesson quiz accepted a synonym), radical Show details and the next session note (AC-7), and audible speech (AC-10; this emulator has no Japanese voice); also unblocks the 0007 synonym steps and the 0008 stage count step)
Spec [0009](../specs/0009-item-pages-and-levels/index.md) · code in `src/app/subjects/`, `src/app/levels/`, `src/app/(tabs)/levels.tsx`, `src/components/subject/`, `src/lib/study/items.ts`, `src/lib/study/levels.ts`, `src/lib/answer/synonym.ts`

## Slice 7: Settings & credits

### 11. Settings & credits · done
Lesson batch size, reminder switches and times, skip ahead to a level, reset progress, and the credits page the data licenses require.
**Done when:** skipping to level 3 retires levels 1 and 2 and opens level 3, and credits list every source.
- [x] Design it (spec, updated 0010 for Android 2026-11-08): `/architect settings & credits`
- [x] Build it: `/develop settings & credits` (built 2026-11-08)
   - [x] Settings screen, Lessons card, and the save path (AC-1, AC-2, AC-4) (built 2026-11-08)
   - [x] Reminders card with the time dialog (AC-3, AC-4) (built 2026-11-08)
   - [x] Skip ahead and reset with their dialogs (AC-5, AC-6, AC-7, AC-8) (built 2026-11-08; checked on the emulator 2026-11-09)
   - [x] About card and the Credits screen (AC-9, AC-10) (built 2026-11-08)
- [x] Verify it (passed 2026-11-09, see `verify.md`; skip timestamps need a dev build): `/check verify settings & credits`
Spec [0010](../specs/0010-settings-and-credits/index.md) · code in `src/app/(tabs)/settings.tsx`, `src/app/credits.tsx`, `src/components/settings/`, `src/lib/study/settings.ts`, `src/lib/credits.ts`

## Slice 8: Review reminders

### 14. Review reminders · done
Local Android notifications so you keep the habit: a daily summary at your chosen time and a due ping when new reviews unlock, never during quiet hours. Builds straight from 0001 §6.5 (pure `src/lib/reminders` planner plus the `src/lib/notifications` wrapper); the reminder switches and times on the Settings screen belong to feature 11.
**Done when:** with reviews waiting, the installed APK shows the daily summary at your chosen time and a due ping when new reviews unlock (at most one per hour), none during quiet hours, and the planner passes its unit tests (0001 AC-7).
- [x] Build it (built 2026-11-09; planner and service unit tested, Android bundle builds; not checked on a device yet): `/develop review reminders`
- [x] Verify it on the installed APK: `/check verify review reminders` (skipped 2026-11-09, marked done by you: in Expo Go on the emulator the app starts, a reminder switch opens Android's permission dialog, Allow hides the permission row, and denied shows the row whose button opens Android's app settings; Expo Go cannot create the notification channel, so delivery, tap routing, and quiet hours are still unchecked on a device and stay in Release build checks)
Spec 0001 §6.5 · code in `src/lib/reminders/`, `src/lib/notifications/`, `src/lib/study/reminders.ts`

## Slice 9: Mnemonic waves

### 12. Mnemonic waves · done
Write original radical names and mnemonics for levels 4 to the last level, a few levels at a time, using the batch workflow and rules from 0001 §5.4 and 0005. Enable each wave once it passes validation.
**Done when:** every level is enabled and `npm run pipeline:validate` passes.
- [x] Write and enable the next wave: `/develop mnemonic waves`
   - [x] Wave 1: levels 4 to 6 written (352 items: 49 radicals, 75 kanji, 228 vocab) and enabled (2026-11-09)
   - [x] Wave 2: levels 7 to 9 written (297 items: 32 radicals, 75 kanji, 190 vocab) and enabled (2026-11-09)
   - [x] Wave 3: levels 10 to 12 written (323 items: 16 radicals, 75 kanji, 232 vocab) and enabled (2026-11-09)
   - [x] Wave 4: levels 13 to 15 written (281 items: 8 radicals, 75 kanji, 198 vocab) and enabled (2026-11-09)
   - [x] Wave 5: levels 16 to 18 written (252 items: 8 radicals, 75 kanji, 169 vocab) and enabled (2026-11-09)
   - [x] Wave 6: levels 19 to 21 written (257 items: 6 radicals, 75 kanji, 176 vocab) and enabled (2026-11-09)
   - [x] Wave 7: levels 22 to 25 written (259 items: 9 radicals, 87 kanji, 163 vocab) and enabled (2026-11-09); all 25 levels are now enabled
   - [x] Verify fix: the 392 one sentence kanji meaning stories (levels 4 to 25) rewritten as 2 to 4 sentence stories, the rule restored in `pipeline/work/README.md`, and the new `kanji-story-length` validator rule added to spec 0005 (2026-11-09)
- [x] Verify it: `/check verify mnemonic waves` (2026-11-09: validate passes with all 25 levels enabled, the story length scratch break fails as expected, bundle rebuild is unchanged, 486 tests pass, and in Expo Go a fresh build reseeds and shows the new 箱 story on level 25)
code in `content/mnemonics/`, `content/enabled-levels.json` · spec [0005](../specs/0005-content-pipeline/index.md), rules 0001 §5.4

## Slice 10: Kaizen Kanji name & emblem

### 15. Kaizen Kanji name & emblem · done
Rename the app to Kaizen Kanji everywhere you see a name (launcher label, splash, app bar, About card, notifications) and use your red seal (white brush kanji on a red stamp) as the launcher icon, adaptive icon, and splash emblem. The package id stays the same so the installed app updates in place and keeps your progress.
**Done when:** the launcher shows Kaizen Kanji with the red seal icon, the splash shows the seal, and no screen still says the old name.
- [x] Build it: `/develop kaizen kanji name & emblem` (built 2026-11-10: `app.json` name, Home title, and every icon made from the seal; package id, slug, and the `kanjisrs` scheme stay so the app updates in place)
Seal source: `assets/kaizen-seal-source.webp` (the image you shared on 2026-11-10). The launcher icon only shows on an installed APK, see Release build checks.
code in `app.json`, `assets/images/`, `src/app/(tabs)/_layout.tsx`
Marked done 2026-11-10 after `/check verify` in Expo Go (Home title, no old name on any screen, every icon file is the seal). The launcher label, launcher and adaptive icons, and seal splash were not checked: they need the installed APK, so that check waits in Release build checks.

## Slice 11: Quick synonyms in lessons & reviews

### 16. Quick synonyms in lessons & reviews · in-progress
Add your own meaning for an item right where you meet it, so a radical you already know under another name stops being marked wrong. A "+ Add synonym" link on the lesson page and an icon in the lesson quiz and review top bar open a sheet with the synonym editor the item page has (feature 10), without leaving the session.
**Done when:** in a review you add "swoosh" for a radical named "speck" from the top bar sheet, and from then on in that session and later ones "swoosh" is accepted (an answer already marked wrong stays wrong).
- [x] Design it (spec): `/architect quick synonyms in lessons & reviews` (2026-11-10, picked from mockups)
- [x] Build it: `/develop quick synonyms in lessons & reviews` (2026-11-10)
   - [x] Session synonyms update in place, verdict untouched (AC-4, AC-5) (built 2026-11-10)
   - [x] Synonym sheet with save, toast, back, and keyboard handling (AC-1, AC-6, AC-7, AC-8, AC-9) (built 2026-11-10)
   - [x] Lesson page link and the top bar icon in the lesson quiz and reviews (AC-1, AC-2, AC-3) (built 2026-11-10; checked in Expo Go on the emulator)
- [ ] Verify it: `/check verify quick synonyms in lessons & reviews`
Spec [0011](../specs/0011-quick-synonyms.md)
code in `src/components/subject/SynonymSheet.tsx`, `src/components/study/` (`SynonymButton.tsx`, `session-synonyms.ts`, `use-quiz-session.ts`, `LessonPage.tsx`), `src/app/lessons.tsx`, `src/app/reviews.tsx`

## Slice 12: Anki mode

### 17. Anki mode · in-progress
A Study style switch in Settings: instead of typing, reviews and the lesson quiz show one card per item, you tap Show answer to see meaning and reading together, then grade yourself (Missed or Got it). The grade feeds the same SRS as typed answers.
**Done when:** with Anki mode on, a review shows the reveal button, grading Missed drops the item a stage like a wrong typed answer, and turning it off brings back typing.
- [x] Design it (spec): `/architect anki mode` (2026-11-10, picked from mockups, cross checked by another model)
- [ ] Build it: `/develop anki mode`
   - [ ] Setting column, migration, and the Study style switch (AC-1, AC-2)
   - [ ] Queue `card` kind and the session hook's reveal and grade (AC-5, AC-6, AC-7, AC-9)
   - [ ] Anki card in reviews and the lesson quiz (AC-3, AC-4, AC-8, AC-10)
- [ ] Verify it: `/check verify anki mode`
Spec [0012](../specs/0012-anki-mode.md)

## Release build checks
Run these once, on one `preview` APK, when the app is feature complete (see **Release builds** at the top). Add an item here whenever a check needs a release build.
- [x] `kanjisrs://dev/ui` lands on Home with no Developer card (feature 4, AC-7; the `href="/"` fix is only checked in Expo Go so far) · passed 2026-11-09 on preview APK versionCode 7 (cold deep link, UI dump shows Home and no Developer card)
- [x] Offline cold start shows the splash in the page color, light `#fafaf9` and dark `#1c1917`, then Home with no white flash (feature 4, AC-3; Expo Go shows its own splash) · passed 2026-11-09 on preview APK versionCode 7 in airplane mode (screen frames read `#fafaf9` and `#1c1917` full screen, then Home)
- [x] Review reminders on the installed APK (feature 14) · passed 2026-11-09 on preview APK versionCode 7: "Reviews ready, 5 reviews are ready" arrives on the `review-reminders` channel (Android held it to the end of its 1 hour inexact window), tapping it opens Reviews, and a ping due at 23:00 moves to the 8:00 quiet end. The notification icon showed as a black square because none was configured; `app.json` now sets a white `notification-icon.png` and the `#d81b60` accent. On preview APK versionCode 9 (2026-11-09) the status bar shows the white glyph. The shade row still shows a black square on the emulator: Android 17 draws the app's launcher icon there, and this emulator image renders some icons black (the Calendar icon too). Confirm the shade icon on a phone
- [x] `maestro/core-loop.yaml` passes on the `e2e` APK (feature 5, 0004 AC-15; feature 7, 0006 AC-9, now ending on the review summary) · passed 2026-11-09 on e2e APK versionCode 8, after the flow gained `scrollUntilVisible` before each debug clock tap and each count check (Home grew new cards, so `home-debug-clock` sits below the fold)
- [ ] Kaizen Kanji launcher label, red seal launcher and adaptive icon, and the seal splash on the installed APK (feature 15)
- [ ] `maestro/core-loop.yaml` gains an Anki mode run (feature 17, spec 0012 Follow-up)
- [x] `kanjisrs://dev/clock` lands on Home, so the debug clock and the progress shortcut cannot run (feature 7, 0006 AC-11) · passed 2026-11-09 on preview APK versionCode 7

## Dropped

### 13. Patch Next.js security advisory · dropped
The build warns that Next.js 16.4.0 has a known security vulnerability. Move to the patched release before more code builds on it.
Dropped 2026-11-01: superseded by the Expo change in spec 0001 (the Next.js scaffold goes away). The patch was built and verified; kept here for history.
**Done when:** `npm audit` shows no advisory for `next`, and typecheck, lint, test, and build still pass.
- [x] Upgrade it: `/develop patch Next.js security advisory`
- [x] Verify it: `/check verify patch Next.js security advisory`
code in `package.json`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **VOICEVOX audio**: generated audio files for vocab, with credit per VOICEVOX terms · needs a decision
- **Desktop and sync**: decided in 0001 Deferred decisions, not built now. A `sync/` Cloudflare Worker with a D1 (SQLite) database; devices push and pull review events and notes; assignments are rebuilt by replaying reviews in `created_at` order through `src/lib/srs`; notes merge last write wins on `updated_at`; each device proves it is you with one long random sync token entered in Settings. Desktop becomes the Expo web build or another client of the same Worker, decided then.
- **Backup**: none until sync exists, so progress lives only on the phone (accepted risk, your choice 2026-11-01, 0001).
- **Kana only vocabulary**: words written without kanji
- **Example sentences**: from an openly licensed corpus · needs a decision
- **Stroke order**: animated stroke order from open data · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Skills locate it by that `(spec)` suffix. Every other box is an execution box and `/architect` never ticks one.

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling).
- **spec stale for Android** = the feature's spec predates the 2026-11-01 Expo change; run `/architect <feature>` to update it before `/develop`. Its Design box is unticked until then; the tag drops and the box is ticked again once the spec is updated.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history). Designed features show `in-progress` because their spec is captured.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing; **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`.
- **Pointer line** (`Spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
