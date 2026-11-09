# src/lib/notifications

Review reminders (scope feature 14): local Android notifications for a daily summary and a due ping. Governing spec: [0001 §6.5](../../../docs/specs/0001-kanji-srs-app/index.md). Three layers, each in its own folder:

- `../reminders/` (pure, root ground rule 5): `planReminders` returns up to `MAX_REMINDERS` (31) `{ fireAt, kind, count }`, with quiet hours, merging, and the 7 day and 24 hour windows. `reminderContent` gives the title and body, `isQuietMinute` and `minutesOfDay` the time math. No DB, clock, or `expo-notifications` here; `timeZoneOffsetMinutes` is local minus UTC (the app passes `-now.getTimezoneOffset()`).
- `../study/reminders.ts`: the DB side. `loadReminderPlan`, `reminderTapRoute`, and the `app_meta.notif_permission_asked` flag.
- this folder: the native wrapper on `expo-notifications`.

## Files

- `index.ts`: `configureNotifications` (once per start: the in app handler and the Android channel `review-reminders`, "Review reminders", default importance), `rescheduleReminders` (cancels every scheduled notification, then schedules the plan as one shot `DATE` triggers on that channel; without the permission it only cancels), `getPermissionState` (`on` / `off` / `unasked`), `requestPermission` (shows Android's dialog, then marks it asked), `askPermissionOnce`, `openAppSettings`, `tapRoute`.
- `use-reminders.ts`: `useReminders()` for the root layout (reschedule at startup and on every return to the foreground; a tapped reminder opens `/reviews` or `/`), and `useSessionReminders(done, answeredAny, { askPermission })` for the lesson and review screens (reschedule when a session ends or you leave after answering; lessons pass `askPermission` so the first finished session asks once).

## Rules

- `rescheduleReminders` runs one call at a time (a promise chain) and never throws: a failure is logged with `console.warn` and never reaches a screen. Call it after anything that changes due counts or reminder settings.
- Local notifications only: no push token, no server, no `SCHEDULE_EXACT_ALARM`, so a reminder may arrive a few minutes late.
- Reminder `data.kind` is `daily` or `due`; the tap handler ignores any other notification.
- Expo Go cannot create the notification channel (`setNotificationChannelAsync` throws), so nothing schedules there and the startup log shows "Could not schedule review reminders". Check delivery on an installed APK (scope Release build checks). The permission dialog and the Settings permission row do work in Expo Go.
- Unit tests: `../reminders/plan.test.ts` (the planner) and `../study/reminders.test.ts` (the DB side). This folder has no unit tests; it is checked on a device.

_Drafted by /sync from the introducing change, worth a quick human pass._
