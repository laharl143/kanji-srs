import { describe, expect, it } from "vitest";

import { nextReviewLabel } from "./next-review-label";

// Local times, so the calendar logic matches the machine running the test.
// Sunday 8 Nov 2026, 22:15.
const NOW = new Date(2026, 10, 8, 22, 15).getTime();
const MIN = 60_000;
const HOUR = 60 * MIN;
const fmt = (t: number) => `${new Date(t).getHours()}h`;
const due = (availableAt: number | null, srsStage = 3) => ({ srsStage, availableAt });

describe("nextReviewLabel", () => {
  it("reads Locked, Lesson ready, and Retired from the stage", () => {
    expect(nextReviewLabel(undefined, NOW, fmt)).toBe("Locked");
    expect(nextReviewLabel(due(null, 0), NOW, fmt)).toBe("Lesson ready");
    expect(nextReviewLabel(due(NOW + HOUR, 9), NOW, fmt)).toBe("Retired");
  });

  it("reads Now when due, past due, or missing a time", () => {
    expect(nextReviewLabel(due(NOW), NOW, fmt)).toBe("Now");
    expect(nextReviewLabel(due(NOW - HOUR), NOW, fmt)).toBe("Now");
    expect(nextReviewLabel(due(null), NOW, fmt)).toBe("Now");
  });

  it("counts minutes, rounded up, under an hour", () => {
    expect(nextReviewLabel(due(NOW + 1), NOW, fmt)).toBe("in 1 min");
    expect(nextReviewLabel(due(NOW + 59 * MIN), NOW, fmt)).toBe("in 59 min");
  });

  it("counts whole hours, rounded down, under 24 hours, even when that falls tomorrow", () => {
    expect(nextReviewLabel(due(NOW + 60 * MIN), NOW, fmt)).toBe("in 1 h");
    expect(nextReviewLabel(due(NOW + 2 * HOUR + 59 * MIN), NOW, fmt)).toBe("in 2 h");
    expect(nextReviewLabel(due(NOW + 23 * HOUR), NOW, fmt)).toBe("in 23 h");
  });

  it("reads Tomorrow on the next calendar day once 24 hours or more away", () => {
    expect(nextReviewLabel(due(NOW + 25 * HOUR), NOW, fmt)).toBe("Tomorrow 23h");
  });

  it("uses the weekday within the next six calendar days", () => {
    expect(nextReviewLabel(due(NOW + 47 * HOUR), NOW, fmt)).toBe("Tue 21h");
    expect(nextReviewLabel(due(new Date(2026, 10, 14, 14).getTime()), NOW, fmt)).toBe("Sat 14h");
  });

  it("uses the date after that, adding the year when it is not this year", () => {
    expect(nextReviewLabel(due(new Date(2026, 10, 16, 14).getTime()), NOW, fmt)).toBe("Nov 16");
    expect(nextReviewLabel(due(new Date(2027, 0, 20, 9).getTime()), NOW, fmt)).toBe("Jan 20, 2027");
  });

  it("formats the hour with the device locale by default", () => {
    expect(nextReviewLabel(due(NOW + 25 * HOUR), NOW)).toMatch(/^Tomorrow .*\d/);
  });
});
