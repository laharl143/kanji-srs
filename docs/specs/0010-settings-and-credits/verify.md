# Verify: settings & credits · spec 0010 · updated 2026-11-08
_Steps derived from spec 0010 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Open the Settings tab → four cards in order: Lessons, Reminders, Progress, About; it loads each time it comes into view → AC-1
- [x] At 360dp (`adb shell wm density 480`) and font scale 1.3, in light and dark → every card reads cleanly and every control is 48dp or more → AC-1
- [x] Tap batch plus twice (5 to 7), then start lessons from Home → the batch has 7 items; minus is disabled at 3, plus at 20 → AC-2
- [x] Tap plus quickly five times → the value ends on the last tap and the saved value matches after leaving and coming back → AC-4 (2026-11-08 after /debug: plus five taps about 200 ms apart 5 to 10, minus five taps about 100 ms apart 10 to 5, and 5 after leaving and coming back)
- [x] Turn Daily summary off → Summary time is greyed and does not open; turn the ping off → both quiet rows are greyed and do not open → AC-3
- [x] Open Summary time and press Cancel (then back, then a tap outside) → nothing changes; open it, pick 8:15, OK → the row shows 8:15 AM (locale format) and it survives a reload → AC-3
- [x] Set Quiet from equal to Quiet until → "Same start and end: no quiet hours" shows under them → AC-3
- [ ] Progress card → "You are on level N"; tap Choose → the stepper starts at N plus 1, the count line updates on each step, and Confirm is disabled while counting → AC-5 (2026-11-09: from level 1 it opens at 2 with "135 items below level 2", plus gives "262 items below level 3" and "Skip to level 3", and after Cancel it reopens at 2. Not seen: the count finishes before a screen capture, so the counting state and the disabled Confirm were never on screen; `SkipAheadDialog.test.ts` covers the text only)
- [x] Confirm "Skip to level N" → toast "Skipped to level L", the card shows L; Home and Levels show the lower levels as Retired and level N radicals as lessons → AC-6
- [ ] Skip to a level with no kanji (if the content has one) → you land above it and the toast names the level you landed on → AC-6 (2026-11-09: not applicable, every level in `content/bundle.json` has 25 kanji; `settings.test.ts` "lands above a level with no kanji" covers it)
- [x] On the highest level → the row says "You are on the highest level" and Choose is disabled → AC-5
- [x] Reset all progress → confirm disabled until `RESET` is typed exactly; after confirm the toast says "Progress reset", the level is 1, level 1 radicals are lessons, notes are gone, and batch size and reminder times are unchanged → AC-7 (2026-11-09: `reset` and `RESE` keep Reset disabled, `RESET` enables it; after confirm the toast "Progress reset", level 1, Home shows 35 lessons and 0 reviews, item 1 is a Lesson with its note and synonym gone, batch 6 and Summary 7:30 AM kept)
- [x] Double tap confirm on skip and on reset → it runs once; while busy, back and a tap outside do nothing; the toast shows after the dialog closes (also try `/dev/ui` → "Open busy dialog") → AC-8 (2026-11-08 after /debug: two taps 130 ms apart on skip and on reset each gave one success toast and no error; back and a tap outside checked on the `/dev/ui` busy dialog)
- [x] About → "App 0.1.0 · content" plus the first 7 characters of the content version → AC-9
- [x] Tap "Credits and licenses" → the Credits screen with a pink app bar and back arrow lists EDRDG, jmdict-simplified, tanos, Noto Sans JP, and Material Design Icons, plus the closing line; each link opens the phone's browser → AC-10

## Value sourcing
- [x] Batch size: change it, kill and reopen the app → the stepper shows the stored `lesson_batch_size` → Value sourcing (settings load)
- [x] Highest level: the skip stepper's plus stops at the highest level in the bundle (`max(subjects.level)`) → Value sourcing
- [x] App version: it matches `app.json` `expo.version` → Value sourcing
- [x] Time rows: switch the phone to a 24 hour locale → rows show `08:00` style; the dialog follows the phone's 24 hour setting → Value sourcing (2026-11-09: Expo Go app locale en-GB plus 24 hour setting, rows read 07:30, 22:00, 08:00 and the dialog opens at 22 with no AM or PM; back to 12 hour after undoing)
- [ ] Skip timestamps: move the debug clock (`/dev/clock`) a day ahead, skip, then open a retired item → its passed and retired times are the shifted day, not the real one → Value sourcing (`now()`) (2026-11-09: blocked, no screen shows passed or retired times and Expo Go's database cannot be read, `run-as` says not debuggable; needs a dev build or a debug readout)
- [x] Skip preview: the count equals the subjects below the level that are not Retired, including ones with no assignment → Value sourcing (`countToRetire`)

## Commands
- [x] `npx vitest run src/lib/study/settings.test.ts src/lib/credits.test.ts` → all pass (patch checks, time round trip, skip, reset, rollbacks, credits coverage) → AC-3, AC-4, AC-5, AC-6, AC-7, AC-9, AC-10
- [x] `npm test` and `npm run typecheck` → pass

## Acceptance-criteria coverage
- AC-1 … Settings tab and 360dp steps · AC-2 … batch size step · AC-3 … switch, time dialog, and quiet hint steps · AC-4 … rapid taps step plus unit tests · AC-5 … Choose and highest level steps · AC-6 … skip steps plus unit tests · AC-7 … reset step plus unit tests · AC-8 … double tap step · AC-9 … About step · AC-10 … Credits step plus `credits.test.ts`
