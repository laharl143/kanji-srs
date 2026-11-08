import { describe, expect, it } from "vitest";

import { HOUR_MS } from "./config";
import { bucketForecast, FORECAST_WINDOW_MS, startOfLocalHour } from "./forecast";

// UTC hour buckets, so the tests never depend on the machine's time zone.
const utcHour = (t: number) => t - (t % HOUR_MS);
const NOW = Date.UTC(2026, 10, 8, 10, 15);
const at = (h: number, m = 0) => Date.UTC(2026, 10, 8, h, m);

describe("bucketForecast", () => {
  it("puts a review due at 10:59 in the 10:00 bucket", () => {
    expect(bucketForecast([at(10, 59)], NOW, 0, utcHour)).toEqual([
      { hourStart: at(10), count: 1, runningTotal: 1 },
    ]);
  });

  it("skips empty hours, sorts by hour, and starts the running total from reviewsNow", () => {
    const times = [at(13, 5), at(11, 30), at(13, 40), at(11, 0)];
    expect(bucketForecast(times, NOW, 44, utcHour)).toEqual([
      { hourStart: at(11), count: 2, runningTotal: 46 },
      { hourStart: at(13), count: 2, runningTotal: 48 },
    ]);
  });

  it("leaves out a review exactly 24 hours from now, and anything before now", () => {
    const times = [NOW - 1, NOW + FORECAST_WINDOW_MS, NOW + FORECAST_WINDOW_MS - 1];
    const rows = bucketForecast(times, NOW, 3, utcHour);
    expect(rows).toEqual([
      { hourStart: utcHour(NOW + FORECAST_WINDOW_MS - 1), count: 1, runningTotal: 4 },
    ]);
  });

  it("returns no rows when nothing comes due", () => {
    expect(bucketForecast([], NOW, 5, utcHour)).toEqual([]);
  });

  it("the last running total is reviews now plus everything in the window", () => {
    const times = Array.from({ length: 30 }, (_, i) => NOW + i * 50 * 60_000);
    const inWindow = times.filter((t) => t < NOW + FORECAST_WINDOW_MS).length;
    const rows = bucketForecast(times, NOW, 7, utcHour);
    expect(rows.at(-1)?.runningTotal).toBe(7 + inWindow);
  });

  it("uses the local hour by default", () => {
    const t = at(15, 42);
    expect(new Date(startOfLocalHour(t)).getMinutes()).toBe(0);
    expect(startOfLocalHour(t)).toBeLessThanOrEqual(t);
    expect(t - startOfLocalHour(t)).toBeLessThan(HOUR_MS);
  });
});
