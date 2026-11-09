# 0010. Settings and credits

**Date**: 2026-10-13 (updated 2026-11-08 for Expo Android)
**Status**: Accepted

## Summary

The Settings tab becomes one scrolling page of cards: lessons per batch, reminder switches and times, skip ahead to a level, reset all progress, and an About card with the app and content versions. A Credits screen, opened from Settings, names every open data source, the font, and the icons, with their licenses, which those licenses require. This update replaces the first version, written for the Next.js web app; the choices were picked from mockups on 2026-11-08. Reminder notifications themselves arrive with feature 14; this feature only saves their settings.

## Requirements

**User stories**:
- As a learner, I want to choose how many new items a lesson batch teaches, so lessons fit the time I have.
- As a learner, I want to set when reminders come and when they stay quiet, so they help without waking me.
- As a learner who already knows some kanji, I want to skip the levels I know, so I do not grind through them.
- As a learner, I want to start over from nothing if I need to, behind a guard so it never happens by accident.
- As the owner, I want every data source credited with its license, so the app meets the license terms.

**Acceptance criteria**:
- **AC-1**: The Settings tab shows four cards on one scroll, in order: **Lessons**, **Reminders**, **Progress**, **About**. It loads from local queries each time it comes into view; a load failure shows an error card with the message and "Try again". It reads cleanly at 360dp width with font scale 1.3, in light and dark, and every touch target is at least 48dp.
- **AC-2**: The Lessons card has "Lessons per batch" with a minus and plus stepper showing the current value (default 5). Each tap changes it by 1 and saves at once; minus is disabled at 3 and plus at 20. The next lesson batch you open uses the new size (a batch already open keeps its size). TalkBack labels: "Fewer lessons per batch", "More lessons per batch", and the value "Lessons per batch, 5".
- **AC-3**: The Reminders card has, in order: a "Daily summary" switch; a "Summary time" row showing the time (default 8:00 AM); a "Ping when reviews unlock" switch; "Quiet from" and "Quiet until" rows (defaults 10:00 PM and 8:00 AM). Tapping a time row opens Android's own time dialog set to that time; OK saves it as `HH:MM` (24 hour, zero padded); Cancel, back, or a tap outside saves nothing. Times on the rows show in the phone's locale format; the dialog follows the phone's own 12 or 24 hour setting (they match unless you set that switch against your locale). The Summary time row is greyed and does not open while Daily summary is off; the two quiet rows are greyed and do not open while the ping switch is off (quiet hours only hold back pings, 0001 §6.5). When quiet start equals quiet end, a line under them says "Same start and end: no quiet hours". Every switch and time saves at once. No notification is scheduled or asked for by this feature (feature 14 adds that).
- **AC-4**: When any save fails, a toast says "Could not save. Try again." and the control goes back to the last value the database confirmed. Saves run one after another in tap order, and each writes the full value (never a step), so a quick run of taps ends on the last value you chose. A value outside its rules (batch size not a whole number from 3 to 20, a time not `HH:MM`) is refused by the service, saves nothing, and shows the same toast (the screen cannot produce one; unit tests cover it).
- **AC-5**: The Progress card shows "Skip ahead" with "You are on level N" and a Choose button. Choose opens a `ConfirmDialog` titled "Skip ahead" with a level stepper from your level plus 1 up to the highest level that has content, starting at your level plus 1 every time it opens, and under it (in the dialog's children) a preview line: "X items below level N become Retired. They will not come up for review. You cannot undo this." (X counts subjects below the chosen level that are not already Retired; with X = 0 it reads "Nothing to retire. You move to level N."). The count reloads on each step; only the answer for the level now shown is used (older answers that arrive late are dropped). Confirm is disabled while the count loads; if counting fails, the line reads "Could not count items. Try again." and Confirm stays disabled until a step or reopen succeeds. The confirm button reads "Skip to level N". When you are already on the highest level, the row says "You are on the highest level" and Choose is disabled.
- **AC-6**: Confirming a skip to level N, in one transaction: every subject below level N becomes stage 9 with `unlocked_at`, `started_at`, `passed_at`, and `burned_at` set to now and `available_at` empty, whether or not it had an assignment; subjects already at stage 9 are left alone; no review rows are written; `current_level` becomes N; then unlocks run as after a review (0006), so level N radicals, level N kanji whose radicals are all passed, and vocab whose kanji are all passed unlock at stage 0. A skip never lowers your level or any stage. Items at stages 1 to 8 lose their real start and pass times (intended). If level N has no kanji, unlocks level you up again at once (0006), so you may land above N; the toast says "Skipped to level L" and the card shows L, where L is your level after the transaction. A failure rolls back everything and shows the save failed toast.
- **AC-7**: The Progress card's "Reset all progress" button opens a `ConfirmDialog` (danger tone) titled "Reset all progress?" with "Deletes all your progress, reviews, notes, and synonyms. Your settings stay. You cannot undo this. Type RESET to confirm." Confirm stays disabled until `RESET` is typed exactly. Confirming, in one transaction: deletes your assignments, reviews, and notes (`resetProgress`), sets your level to 1, keeps every other setting and every `app_meta` key (content version, debug clock offset, notification flags, the Home check), then runs unlocks so level 1 radicals are back at stage 0. Afterwards a toast says "Progress reset". A failure rolls back everything and shows the save failed toast.
- **AC-8**: While a skip or reset write runs, its confirm button is disabled and shows it is busy, and back or a tap outside does nothing, so a double tap cannot run it twice. When the write ends, success or failure, the dialog closes first and then the toast shows (a toast raised under an open dialog would be hidden).
- **AC-9**: The About card has a "Credits and licenses" row that pushes `/credits`, and a small line "App X · content Y": X is the app version from `app.json` ("unknown" when missing), Y the first 7 characters of the stored content version ("unknown" when missing).
- **AC-10**: `/credits` is a pushed screen titled "Credits" (pink app bar, back arrow) listing, as cards: JMdict, KANJIDIC2, and KRADFILE by the Electronic Dictionary Research and Development Group, CC BY-SA 4.0, with the note "Adapted: converted to JSON and filtered to the words and kanji this app teaches"; the JSON conversion by jmdict-simplified (scriptin), CC BY-SA 4.0; the JLPT N5 to N3 kanji and vocab lists by Jonathan Waller (tanos.co.uk), Creative Commons BY, adapted the same way; the Noto Sans JP font, "Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'", SIL Open Font License 1.1; Material Design Icons by Pictogrammers, Apache License 2.0; and a closing line "Radical names and mnemonics are original to this app." Each card's links (the source, and the license text) open in the phone's browser. A unit test checks that every source in the committed `SOURCES` list (`pipeline/src/sources.ts`) is covered by a credit whose license matches that source's license.

## Decision

**Chosen option**: a Settings tab of four cards (Lessons, Reminders, Progress, About) that saves each change at once through a new local service `src/lib/study/settings.ts`; Android's time dialog from `@react-native-community/datetimepicker`; skip ahead and reset built on the existing `raiseAssignmentsBelowLevel`, `resetProgress`, and `runProgression`, each in one `withTransaction`; a pushed `/credits` screen fed by a typed list in `src/lib/credits.ts` that a unit test checks against the committed `SOURCES` list in `pipeline/src/sources.ts`. There is no schema change. Reminder delivery, the permission row, and rescheduling stay with feature 14.

The old pure `planSkip` is dropped: the skip is a set based write in SQL (`raiseAssignmentsBelowLevel`, already tested in 0002), and the unlock math already lives in the pure `planProgression`. A second pure planner would duplicate both.

**Implementation skills**: `expo-overview` (`expo/skills`, `.agents/skills/expo-overview/`), for adding the date time picker with `npx expo install` · `expo-router` (`expo/skills`, `.agents/skills/expo-router/`), for the new pushed `/credits` route and its header · `vercel-react-native-skills` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-native-skills/`), for list and form render rules.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no schema change, no migration. Reads `user_settings` (all columns), `subjects.level`, `assignments.srs_stage`, `app_meta.content_version`. Writes `user_settings` (`lesson_batch_size`, the five reminder columns, `current_level`), `assignments` (skip and reset), and deletes from `reviews` and `user_notes` (reset only, the one allowed delete).

**Routes and files**:
- `src/app/(tabs)/settings.tsx`: replaces the placeholder. Uses `useFocusEffect` to load, like Home.
- `src/app/credits.tsx`: new, on the root stack, title "Credits" via `<Stack.Screen options>`; gets the `AppBar` with a back arrow (0003 AC-4).
- `src/components/settings/`: new folder: `SettingsCard` (titled card), `Stepper` (minus, value, plus; used for batch size and the skip level), `SwitchRow`, `TimeRow` (when enabled, opens `DateTimePickerAndroid.open` with `mode: "time"`, `value` = the stored time via `fromHHMM`, and `is24Hour` unset so it follows the phone; its `onChange` saves only when `event.type === "set"`, and `"dismissed"` saves nothing), `SkipAheadDialog`, `ResetDialog`, `CreditCard`.
- `src/components/ui/ConfirmDialog.tsx`: gains `confirmDisabled?: boolean` (combined with the `requireText` check) and `busy?: boolean` (confirm disabled with a busy label, and `onRequestClose` and the scrim tap ignored while true). Add both variants to `/dev/ui`.
- Save queue: the Settings screen chains every `saveSettings` call on one promise, so saves run in tap order; the screen keeps `confirmed` (the last row a save returned) and rolls a control back to it on failure.
- `src/lib/study/settings.ts`: the service below, plus pure exports `checkSettingsPatch`, `toHHMM(date)`, and `fromHHMM(text, base)` (`base` is `now()`; the result is that day at the stored hours and minutes, local time).
- `src/lib/credits.ts`: `CREDITS: Credit[]` where `Credit = { id, heading, title, by, license, note?, links: { label, url }[], sourceFiles: string[] }`; `sourceFiles` names the files from the committed `SOURCES` list (`pipeline/src/sources.ts`) the entry covers. `pipeline/raw/SOURCES.json` is gitignored, so nothing reads it. Every text and link is hand typed: EDRDG licence `https://www.edrdg.org/edrdg/licence.html`; CC BY-SA 4.0 `https://creativecommons.org/licenses/by-sa/4.0/`; jmdict-simplified `https://github.com/scriptin/jmdict-simplified`; tanos `https://www.tanos.co.uk/jlpt/`; CC BY 4.0 `https://creativecommons.org/licenses/by/4.0/`; Noto Sans JP `https://fonts.google.com/noto/specimen/Noto+Sans+JP`; OFL 1.1 `https://openfontlicense.org/`; Material Design Icons `https://github.com/Templarian/MaterialDesign` with Apache 2.0 `https://www.apache.org/licenses/LICENSE-2.0`. The font copyright line is the one in `node_modules/@expo-google-fonts/noto-sans-jp/LICENSE_FONT`. Check the MDI license once against that repo while building; if it changed, use what it says.
- New queries: `getMaxLevel(db)` in `queries/subjects.ts` (`max(subjects.level)`), and `countToRetire(db, userId, level)` in `queries/assignments.ts` (subjects with `level < level` and no assignment or `srs_stage < 9`).

**Service surface** (`src/lib/study/settings.ts`; every function takes `db` then `userId` first, per `src/lib/db/AGENTS.md`; `now` is a `Date` from `now()` in `src/lib/clock`):
| Function | Inputs after `db, userId` | Output | Errors |
|---|---|---|---|
| `getSettingsPage` | none | `{ settings: UserSettings, maxLevel: number, contentVersion: string \| null }` | thrown DB error → error card |
| `saveSettings` | `patch: SettingsPatch` limited to `lessonBatchSize`, `reminderDailyEnabled`, `reminderDailyTime`, `reminderDueEnabled`, `quietHoursStart`, `quietHoursEnd` | `{ ok: true, settings }` (the saved row) | `{ ok: false, error: "invalid" }` when `checkSettingsPatch` refuses (the screen shows the save failed toast); throws when your settings row is missing, like `runProgression`; thrown DB error → toast |
| `skipToLevel` | `level: number`, `now` | `{ ok: true, level }` where `level` is `current_level` read after `runProgression` (may be above the asked level) | `{ ok: false, error: "invalid" }` when `level <= current_level` or `level > maxLevel` or not a whole number; thrown DB error → rolled back, toast |
| `resetAllProgress` | `now` | `{ ok: true }` | thrown DB error → rolled back, toast |

`skipToLevel` runs inside one `withTransaction`: read settings and max level, check the level, `raiseAssignmentsBelowLevel(tx, userId, level, { srsStage: 9, unlockedAt, startedAt, passedAt, burnedAt: now, availableAt: null })`, `updateSettings(tx, userId, { currentLevel: level })`, then `runProgression(tx, userId, now)`, then read `current_level` again for the result. The skip dialog calls the `countToRetire` query directly for its preview (no service wrapper), with a request counter so only the answer for the level now shown is used. `resetAllProgress` runs `resetProgress(tx, userId, now)` then `runProgression(tx, userId, now)` in one `withTransaction`.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Settings load | batch size, switches, times, current level | `user_settings` row (`getSettings`; startup created it) |
| Settings load | highest level with content | `getMaxLevel` over `subjects.level` |
| About line | app version | `Constants.expoConfig?.version` from `expo-constants` (installed), from `app.json`; "unknown" when missing |
| About line | content version | `app_meta.content_version` (`getMeta(db, CONTENT_VERSION_KEY)`), first 7 characters; "unknown" when missing |
| Time rows | shown time | stored `HH:MM` turned into a `Date` today by `fromHHMM`, shown with `toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })` (device locale, like `localHour`; not Android's 24 hour switch, accepted in AC-3) |
| Time dialog OK | stored time | the dialog's `Date` → `toHHMM` (local hours and minutes, zero padded) |
| Skip dialog | level range | from `current_level + 1` to `getMaxLevel` |
| Skip dialog | "X items become Retired" | `countToRetire(level)` |
| Skip and reset | timestamps | `now()` from `src/lib/clock` (so the debug clock moves them) |
| Next lesson batch | batch size | `user_settings.lesson_batch_size`, already read by `src/lib/study/lessons.ts` |
| Credits | names, licenses, notes, links | `CREDITS` in `src/lib/credits.ts`, hand typed (see Routes and files) |
| Skip toast and card | level landed on | `skipToLevel` result (`current_level` after unlocks) |

**Key invariants**:
- `lesson_batch_size` is a whole number from 3 to 20; reminder times match `^([01]\d|2[0-3]):[0-5]\d$`. Checked in `checkSettingsPatch` (pure, tested) before any write.
- Skip ahead only moves up and never lowers a stage; it writes no review rows.
- Reset is the only path that deletes from `reviews`; it keeps `user_settings` (except `current_level`) and `app_meta`.
- Skip and reset each leave the database either fully changed or unchanged (one transaction, unlocks inside it).
- Credits cover every `SOURCES[].file` in `pipeline/src/sources.ts` (union of `sourceFiles`), and each covering credit's `license` names the same license as that source.

**Security model**: one local user on one phone; no network, no accounts. The only guards are against your own mistakes: the typed `RESET`, the skip preview, and the busy state. No regulated data.

**Configuration required**: none. One new package, `@react-native-community/datetimepicker`, added with `npx expo install` so the version matches SDK 58.

**Edge cases**:
- Already on the highest level: Choose disabled (AC-5). A new bundle that adds levels enables it again on the next load.
- A lesson batch already open keeps its size; the change applies to the next one.
- Rapid stepper taps: the screen shows the new value at once; saves queue in tap order, each writing the full value, and a failure rolls back to the last confirmed row.
- The time dialog dismissed by back or a tap outside: no change.
- Settings is a tab and lessons and reviews are pushed over the tabs, so a skip or reset cannot run during a session.
- Home and Levels reload on focus, so they show the new level and stages after a skip or reset.
- A later content update that adds subjects below your level unlocks them as lessons (stage 0), not Retired; skip only retires what exists when you confirm.
- The app killed in the middle of a skip or reset: `withTransaction` never committed, so SQLite rolls it back on the next open.

**Critical test scenarios**:
- `checkSettingsPatch` accepts 3 and 20, refuses 2, 21, 5.5, "25:00", "8:00", verifies **AC-4**
- `skipToLevel` to 3 from level 1: every level 1 and 2 subject is stage 9 with timestamps at now and `available_at` null, no review rows, level 3 radicals at stage 0, `current_level` 3; a stage 9 row keeps its old `burned_at`, verifies **AC-6**
- `skipToLevel` to a level at or below the current one, or above the max, returns `invalid` and writes nothing, verifies **AC-5**, **AC-6**
- `countToRetire` counts only subjects below the level that are not stage 9, including ones with no assignment, verifies **AC-5**
- `skipToLevel` to a level with no kanji lands on the level above and returns it, verifies **AC-6**
- A value `checkSettingsPatch` refuses: `saveSettings` returns `invalid` and writes nothing, verifies **AC-4**
- `toHHMM` and `fromHHMM` round trip 00:00, 08:05, 23:59, verifies **AC-3**
- `resetAllProgress` leaves no assignments, reviews, or notes, level 1 radicals at stage 0, `current_level` 1, and batch size and reminder times unchanged, verifies **AC-7**
- A forced failure inside `skipToLevel` leaves the database unchanged, verifies **AC-6**
- `credits.test.ts`: every file in `SOURCES` (`pipeline/src/sources.ts`) appears in some credit's `sourceFiles`, and that credit's license matches the source's, verifies **AC-10**
- On a device: change batch size to 7 and the next lesson batch has 7 items; open each time dialog and cancel one; double tap Skip and Reset confirm and see one run; type `RESET`; open Credits and follow a link, verifies **AC-1**, **AC-2**, **AC-3**, **AC-8**, **AC-9**, **AC-10**

## Build plan

Tracer Bullet: one thin thread from screen to database first (batch size), then thicken one card at a time.

1. [x] Service skeleton: `getSettingsPage`, `saveSettings`, `checkSettingsPatch` with tests; Settings screen with the Lessons card, its stepper, the save queue, the load and error states, and the save failed toast, satisfies **AC-1**, **AC-2**, **AC-4**
2. [x] Reminders card: install `@react-native-community/datetimepicker`, `SwitchRow`, `TimeRow`, `toHHMM` and `fromHHMM` with tests, greyed rows, the quiet hours hint, satisfies **AC-3**, **AC-4**
3. [x] Skip ahead: `ConfirmDialog` gains `confirmDisabled` and `busy` (plus `/dev/ui` variants); `getMaxLevel`, `countToRetire`, `skipToLevel` with tests; `SkipAheadDialog` with the stepper, preview, close then toast, and busy state, satisfies **AC-5**, **AC-6**, **AC-8**
4. [x] Reset: `resetAllProgress` with tests; `ResetDialog` with typed `RESET` and busy state, satisfies **AC-7**, **AC-8**
5. [x] About card and Credits: `src/lib/credits.ts` plus `credits.test.ts`, `src/app/credits.tsx`, the Credits row and version line, satisfies **AC-9**, **AC-10**

## Consequences

**Positive**:
- You can start at the right level, tune lesson size, and meet the license terms.
- No new write paths: skip and reset reuse queries already tested in 0002 and unlocks from 0006.

**Negative / tradeoffs**:
- Skip and reset cannot be undone, and reset also deletes your notes and synonyms (hence the typed confirmation and the preview).
- Until feature 14 lands, the reminder switches and times save but no notification fires.
- One new native package (the date time picker); it ships in Expo Go, so no development build is needed.
- Adding a data source means touching `pipeline/src/sources.ts` and `src/lib/credits.ts`; the test catches a miss.

**Neutral**:
- `src/components/settings/` is a new component folder; `/sync` should give it a nested `AGENTS.md` if it grows rules.
- The old AC about a footer link on every page and the VOICEVOX credit are gone (no footer on Android; VOICEVOX stays deferred in the scope).

## Follow-up

- [ ] Feature 14 (review reminders): call the reschedule after a reminder setting saves, after a skip, and after a reset (0001 §6.5 "When to reschedule"), and add the notification permission row to the Reminders card (0001 §6.5 "Permission").
- [ ] The 0001 Follow-up item for 0010 can be ticked once this spec is confirmed (`/sync`).
- [ ] When VOICEVOX audio or another source is added, add its credit entry (ground rule 4).
