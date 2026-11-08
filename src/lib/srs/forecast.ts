// The Next 24 hours list on Home (spec 0008 AC-2). Pure: no DB, framework, or clock.
import { HOUR_MS } from "./config";

export type ForecastRow = { hourStart: number; count: number; runningTotal: number };

export const FORECAST_WINDOW_MS = 24 * HOUR_MS;

// The start of the device local clock hour that holds `time`.
export function startOfLocalHour(time: number): number {
  const d = new Date(time);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

/**
 * Groups review times into clock hours. Only times in `[now, now + 24h)` count; hours with no
 * reviews never appear. Rows are sorted by `hourStart`, and `runningTotal` starts from
 * `reviewsNow` (the reviews already due) and adds each row's count. `startOfHour` is injected so
 * tests can pin the time zone.
 */
export function bucketForecast(
  times: readonly number[],
  now: number,
  reviewsNow: number,
  startOfHour: (time: number) => number = startOfLocalHour,
): ForecastRow[] {
  const end = now + FORECAST_WINDOW_MS;
  const counts = new Map<number, number>();
  for (const t of times) {
    if (t < now || t >= end) continue;
    const hour = startOfHour(t);
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  let runningTotal = reviewsNow;
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hourStart, count]) => {
      runningTotal += count;
      return { hourStart, count, runningTotal };
    });
}
