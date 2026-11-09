import { countDue, getScheduledAssignments } from "@/lib/db/queries/assignments";
import { getMeta, setMeta } from "@/lib/db/queries/meta";
import { getSettings } from "@/lib/db/queries/settings";
import type { Db } from "@/lib/db/types";
import { planReminders, type PlannedReminder } from "@/lib/reminders";

// The reminder service (0001 §6.5): loads what the pure planner needs. `src/lib/notifications`
// schedules the result; nothing here touches Expo.

export const NOTIF_PERMISSION_ASKED_KEY = "notif_permission_asked";

/**
 * Plans the reminders for `userId` as of `now`. `timeZoneOffsetMinutes` is local time minus UTC
 * (the app passes `-now.getTimezoneOffset()`). Throws on a DB failure or a missing settings row.
 */
export async function loadReminderPlan(
  db: Db,
  userId: string,
  now: Date,
  timeZoneOffsetMinutes: number,
): Promise<PlannedReminder[]> {
  const settings = await getSettings(db, userId);
  if (!settings) throw new Error("No user settings: startup has not run");
  const assignments = await getScheduledAssignments(db, userId);
  return planReminders({ assignments, settings, now, timeZoneOffsetMinutes });
}

// Where a tapped reminder opens (0001 §6.5): the reviews screen when any are due, else Home.
export async function reminderTapRoute(
  db: Db,
  userId: string,
  now: Date,
): Promise<"/reviews" | "/"> {
  return (await countDue(db, userId, now.getTime())) > 0 ? "/reviews" : "/";
}

export async function wasPermissionAsked(db: Db): Promise<boolean> {
  return (await getMeta(db, NOTIF_PERMISSION_ASKED_KEY)) === "1";
}

export async function markPermissionAsked(db: Db): Promise<void> {
  await setMeta(db, NOTIF_PERMISSION_ASKED_KEY, "1");
}
