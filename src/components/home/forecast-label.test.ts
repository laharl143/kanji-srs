import { describe, expect, it } from "vitest";

import { forecastLabel, forecastRowLabel } from "./forecast-label";

// Local times, so the day logic matches the machine running the test.
const NOW = new Date(2026, 10, 8, 22, 15).getTime();
const at = (day: number, h: number) => new Date(2026, 10, day, h).getTime();
const fmt = (t: number) => `${new Date(t).getHours()}h`;

describe("forecastLabel", () => {
  it("reads 'This hour' for the current hour", () => {
    expect(forecastLabel(at(8, 22), NOW, fmt)).toBe("This hour");
  });

  it("uses the plain hour later today", () => {
    expect(forecastLabel(at(8, 23), NOW, fmt)).toBe("23h");
  });

  it("prefixes 'Tomorrow' on the next calendar day", () => {
    expect(forecastLabel(at(9, 3), NOW, fmt)).toBe("Tomorrow 3h");
  });

  it("formats with the device locale by default", () => {
    expect(forecastLabel(at(8, 23), NOW)).toMatch(/\d/);
  });
});

describe("forecastRowLabel", () => {
  it("reads one row as one sentence", () => {
    expect(forecastRowLabel({ hourStart: at(8, 23), count: 12, runningTotal: 56 }, NOW, fmt)).toBe(
      "At 23h, 12 more reviews, 56 total",
    );
    expect(forecastRowLabel({ hourStart: at(8, 22), count: 1, runningTotal: 5 }, NOW, fmt)).toBe(
      "This hour, 1 more review, 5 total",
    );
    expect(forecastRowLabel({ hourStart: at(9, 3), count: 2, runningTotal: 7 }, NOW, fmt)).toBe(
      "Tomorrow at 3h, 2 more reviews, 7 total",
    );
  });
});
