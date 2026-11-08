import { localHour } from "@/components/home/forecast-label";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type ReviewTiming = { srsStage: number; availableAt: number | null } | undefined;

// Whole local calendar days from `now` to `time` (DST safe: midnights rounded to whole days).
function calendarDaysBetween(now: number, time: number): number {
  const a = new Date(now);
  const b = new Date(time);
  const startA = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const startB = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((startB - startA) / DAY_MS);
}

/**
 * The next review text on an item page (spec 0009 AC-3). `now` comes from `now()` in
 * `@/lib/clock`; `formatHour` defaults to the Home forecast's device locale hour.
 */
export function nextReviewLabel(
  assignment: ReviewTiming,
  now: number,
  formatHour: (time: number) => string = localHour,
): string {
  if (!assignment) return "Locked";
  if (assignment.srsStage === 0) return "Lesson ready";
  if (assignment.srsStage >= 9) return "Retired";
  const at = assignment.availableAt;
  if (at === null || at <= now) return "Now";

  const diff = at - now;
  if (diff < HOUR_MS) return `in ${Math.ceil(diff / MINUTE_MS)} min`;
  if (diff < DAY_MS) return `in ${Math.max(1, Math.floor(diff / HOUR_MS))} h`;

  const days = calendarDaysBetween(now, at);
  const date = new Date(at);
  if (days === 1) return `Tomorrow ${formatHour(at)}`;
  // Up to six days ahead, so the weekday never repeats today's.
  if (days <= 6) return `${WEEKDAYS[date.getDay()]} ${formatHour(at)}`;
  const day = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === new Date(now).getFullYear() ? day : `${day}, ${date.getFullYear()}`;
}
