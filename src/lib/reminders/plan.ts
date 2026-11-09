// The review reminder schedule (0001 §6.5). Pure: no DB, framework, clock, or Expo module.
// `src/lib/notifications` hands the result to expo-notifications.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const DAILY_DAYS = 7;
export const PING_HOURS = 24;
// 7 daily summaries plus 24 pings (0001 §6.5 "Cap").
export const MAX_REMINDERS = DAILY_DAYS + PING_HOURS;

export type ReminderKind = "daily" | "due";

export type PlannedReminder = { fireAt: Date; kind: ReminderKind; count: number };

export type ReminderAssignment = { srsStage: number; availableAt: number | null };

export type ReminderSettings = {
  reminderDailyEnabled: boolean;
  reminderDailyTime: string;
  reminderDueEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

export type PlanInput = {
  assignments: readonly ReminderAssignment[];
  settings: ReminderSettings;
  now: Date;
  // Local time minus UTC, in minutes (Tokyo is +540). The app passes `-now.getTimezoneOffset()`.
  timeZoneOffsetMinutes: number;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Minutes after local midnight for an `HH:MM` text; null when unreadable.
export function minutesOfDay(text: string): number | null {
  const match = TIME_PATTERN.exec(text);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// A due count at `t`: stage 1 to 8 with `available_at <= t`. Takes the due times sorted.
function dueCounter(assignments: readonly ReminderAssignment[]): (t: number) => number {
  const times = assignments
    .filter((a) => a.srsStage >= 1 && a.srsStage <= 8 && a.availableAt !== null)
    .map((a) => a.availableAt as number)
    .sort((a, b) => a - b);
  return (t) => {
    // The number of times <= t (binary search for the first time > t).
    let lo = 0;
    let hi = times.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
}

/**
 * Plans every reminder for the next 7 days (daily summaries) and 24 hours (due pings), sorted by
 * `fireAt`. Each carries the total due count at its `fireAt` (0001 §6.5):
 * - Daily: at `reminderDailyTime` local on each of the next 7 days from today; today is skipped
 *   once that time has passed, and so is any day whose count is 0. Quiet hours do not apply.
 * - Due: at each local hour start in the next 24 hours where the count beats the last count
 *   notified (the count at `now` first). A ping inside quiet hours moves to the quiet end; pings
 *   then sharing a local hour merge into the latest one, and a ping sharing a local hour with a
 *   daily summary is dropped.
 */
export function planReminders({
  assignments,
  settings,
  now,
  timeZoneOffsetMinutes,
}: PlanInput): PlannedReminder[] {
  const offsetMs = timeZoneOffsetMinutes * MINUTE_MS;
  const nowMs = now.getTime();
  const count = dueCounter(assignments);
  // Local clock arithmetic happens on "local ms" (UTC ms plus the offset).
  const toLocal = (t: number) => t + offsetMs;
  const fromLocal = (t: number) => t - offsetMs;
  const localDayStart = (t: number) => Math.floor(toLocal(t) / DAY_MS) * DAY_MS;
  const localHourKey = (t: number) => Math.floor(toLocal(t) / HOUR_MS);

  const daily: PlannedReminder[] = [];
  const dailyMinutes = minutesOfDay(settings.reminderDailyTime);
  if (settings.reminderDailyEnabled && dailyMinutes !== null) {
    const today = localDayStart(nowMs);
    for (let d = 0; d < DAILY_DAYS; d++) {
      const fireAt = fromLocal(today + d * DAY_MS + dailyMinutes * MINUTE_MS);
      if (fireAt <= nowMs) continue;
      const n = count(fireAt);
      if (n > 0) daily.push({ fireAt: new Date(fireAt), kind: "daily", count: n });
    }
  }

  const pings: PlannedReminder[] = [];
  if (settings.reminderDueEnabled) {
    const quiet = quietWindow(settings.quietHoursStart, settings.quietHoursEnd);
    const firstHour = fromLocal(Math.floor(toLocal(nowMs) / HOUR_MS) * HOUR_MS) + HOUR_MS;
    let last = count(nowMs);
    const raw: number[] = [];
    for (let h = 0; h < PING_HOURS; h++) {
      const t = firstHour + h * HOUR_MS;
      const n = count(t);
      if (n > last) {
        raw.push(t);
        last = n;
      }
    }
    // Move pings out of quiet hours, then keep the latest ping in each local hour.
    const byHour = new Map<number, number>();
    for (const t of raw) {
      const moved = quiet ? moveOutOfQuiet(t, quiet, toLocal, fromLocal) : t;
      const key = localHourKey(moved);
      byHour.set(key, Math.max(byHour.get(key) ?? moved, moved));
    }
    const dailyHours = new Set(daily.map((r) => localHourKey(r.fireAt.getTime())));
    for (const [key, t] of byHour) {
      if (dailyHours.has(key)) continue;
      pings.push({ fireAt: new Date(t), kind: "due", count: count(t) });
    }
  }

  return [...daily, ...pings]
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
    .slice(0, MAX_REMINDERS);
}

type Quiet = { start: number; end: number };

// Null means no quiet hours: equal start and end, or an unreadable time.
function quietWindow(startText: string, endText: string): Quiet | null {
  const start = minutesOfDay(startText);
  const end = minutesOfDay(endText);
  if (start === null || end === null || start === end) return null;
  return { start, end };
}

// Whether a local minute of the day is inside the window; the window may cross midnight, and
// its end is not inside it.
export function isQuietMinute(minute: number, quiet: Quiet): boolean {
  return quiet.start < quiet.end
    ? minute >= quiet.start && minute < quiet.end
    : minute >= quiet.start || minute < quiet.end;
}

// A time inside quiet hours moves to the next quiet end; other times stay.
function moveOutOfQuiet(
  t: number,
  quiet: Quiet,
  toLocal: (t: number) => number,
  fromLocal: (t: number) => number,
): number {
  const local = toLocal(t);
  const dayStart = Math.floor(local / DAY_MS) * DAY_MS;
  const minute = Math.floor((local - dayStart) / MINUTE_MS);
  if (!isQuietMinute(minute, quiet)) return t;
  let end = dayStart + quiet.end * MINUTE_MS;
  if (end <= local) end += DAY_MS;
  return fromLocal(end);
}

export const REMINDER_TITLES: Record<ReminderKind, string> = {
  daily: "Reviews waiting",
  due: "Reviews ready",
};

// The notification text (0001 §6.5 "Notification look").
export function reminderContent(r: Pick<PlannedReminder, "kind" | "count">): {
  title: string;
  body: string;
} {
  const one = r.count === 1;
  const body =
    r.kind === "daily"
      ? `${r.count} ${one ? "review" : "reviews"} waiting`
      : `${r.count} ${one ? "review is" : "reviews are"} ready`;
  return { title: REMINDER_TITLES[r.kind], body };
}
