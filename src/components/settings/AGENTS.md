# src/components/settings

The pieces of the Settings tab (`src/app/(tabs)/settings.tsx`) and the Credits screen (`src/app/credits.tsx`). Governing spec: [0010 settings and credits](../../../docs/specs/0010-settings-and-credits/index.md). Built on the base kit in `../ui/` (see its AGENTS.md); data comes from `@/lib/study/settings` and `@/lib/credits`.

## Files

Import from the barrel `@/components/settings` (`index.ts`).

- `SettingsCard.tsx`: one titled card on the Settings tab (Lessons, Reminders, Progress, About).
- `Stepper.tsx`: minus, value, plus within `min` and `max`. It steps from the last value it sent (a ref synced in a layout effect), so fast taps add up before the next render (AC-4).
- `SwitchRow.tsx`: a labeled switch; the whole row toggles it.
- `TimeRow.tsx`: `formatTime` shows the stored `HH:MM` in the phone's locale format (`toLocaleTimeString`); the row opens `DateTimePickerAndroid` from `@react-native-community/datetimepicker` with `is24Hour` left unset, so the dialog follows the phone's 24 hour switch.
- `SkipAheadDialog.tsx`: level stepper that starts at current level plus 1 on every open, and `previewText` ("X items below level N become Retired"). A request counter drops stale `countToRetire` results; Confirm is disabled while counting.
- `ResetDialog.tsx`: danger tone `ConfirmDialog` with `requireText="RESET"`.
- `CreditCard.tsx`: one entry from `CREDITS` with links that open the phone's browser.

## Rules

- Every change saves at once through `saveSettings`. A failed save shows the toast "Could not save. Try again." and puts the control back to its saved value.
- Reminders (feature 14): after a reminder save, skip, or reset the screen calls `rescheduleReminders`; switching a reminder on asks for the notification permission when it is not on. The permission row (`settings-notifications`) shows only when notifications are not allowed, and offers Android's dialog (never asked) or Android's app settings (denied).
- Skip and reset pass `busy` to `ConfirmDialog` while the write runs, and the screen ignores a second confirm until the first finishes (AC-8). Close the dialog first, then show the toast.
- A new data source is credited in `src/lib/credits.ts` (`sourceFiles` must cover `pipeline/src/sources.ts`); `src/lib/credits.test.ts` fails otherwise.
- `testID`s (`credit-<id>`, the stepper's `-minus`, `-plus`, `-value`) are for scripted checks; every touch target is at least 48dp.
- `/dev/ui` has an "Open busy dialog" button for checking the busy state by hand.

_Drafted by /sync from the introducing change, worth a quick human pass._
