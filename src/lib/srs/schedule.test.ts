import { describe, expect, it } from "vitest";

import type { Assignment } from "@/lib/db/schema";

import { INTERVAL_MS } from "./config";
import { applyReview, completeLesson, newStage, nextAvailableAt } from "./schedule";

const HOUR = 3_600_000;
const NOW = new Date("2026-11-02T10:37:12.345Z");
const FLOOR = new Date("2026-11-02T10:00:00Z").getTime();

const assignment = (srsStage: number, extra: Partial<Assignment> = {}): Assignment => ({
  userId: "local",
  subjectId: 7,
  srsStage,
  unlockedAt: 0,
  startedAt: 0,
  availableAt: 0,
  passedAt: null,
  burnedAt: null,
  ...extra,
});

describe("nextAvailableAt", () => {
  it("adds the stage interval and rounds down to the hour", () => {
    expect(nextAvailableAt(1, NOW)!.getTime()).toBe(FLOOR + 4 * HOUR);
    expect(nextAvailableAt(2, NOW)!.getTime()).toBe(FLOOR + 8 * HOUR);
    expect(nextAvailableAt(8, NOW)!.getTime()).toBe(FLOOR + 120 * 24 * HOUR);
  });

  it("is exact on the hour and null at stage 9", () => {
    expect(nextAvailableAt(1, new Date(FLOOR))!.getTime()).toBe(FLOOR + 4 * HOUR);
    expect(nextAvailableAt(9, NOW)).toBeNull();
  });

  it("covers every stage 1 to 8 and throws for a stage with no interval", () => {
    expect(Object.keys(INTERVAL_MS).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(() => nextAvailableAt(0, NOW)).toThrow();
  });
});

describe("completeLesson", () => {
  it("moves to stage 1, started now, first review 4 hours later on the hour", () => {
    expect(completeLesson(assignment(0), NOW)).toEqual({
      srsStage: 1,
      startedAt: NOW.getTime(),
      availableAt: FLOOR + 4 * HOUR,
    });
  });
});

describe("newStage", () => {
  // [stage, wrong total] -> new stage, per 0001 §6.3.
  const cases: [number, number, number][] = [
    [1, 0, 2],
    [1, 1, 1],
    [1, 2, 1],
    [1, 3, 1],
    [4, 0, 5],
    [4, 1, 3],
    [4, 2, 3],
    [4, 3, 2],
    [5, 0, 6],
    [5, 1, 3],
    [5, 2, 3],
    [5, 3, 1],
    [8, 0, 9],
    [8, 1, 6],
    [8, 2, 6],
    [8, 3, 4],
  ];
  it.each(cases)("stage %i with %i wrong goes to %i", (stage, wrong, expected) => {
    expect(newStage(stage, wrong, 0)).toBe(expected);
    expect(newStage(stage, 0, wrong)).toBe(expected);
  });

  it("adds meaning and reading wrong counts together", () => {
    expect(newStage(8, 2, 1)).toBe(4);
  });
});

describe("applyReview", () => {
  it("writes the new stage, next time, and a review row", () => {
    expect(applyReview(assignment(1), 0, 0, NOW)).toEqual({
      patch: { srsStage: 2, availableAt: FLOOR + 8 * HOUR },
      review: {
        subjectId: 7,
        createdAt: NOW.getTime(),
        startingStage: 1,
        endingStage: 2,
        incorrectMeaningCount: 0,
        incorrectReadingCount: 0,
      },
    });
  });

  it("sets passed_at the first time the stage reaches 5, and only then", () => {
    expect(applyReview(assignment(4), 0, 0, NOW).patch.passedAt).toBe(NOW.getTime());
    expect(applyReview(assignment(5, { passedAt: 123 }), 0, 0, NOW).patch).not.toHaveProperty(
      "passedAt",
    );
    expect(applyReview(assignment(4), 1, 0, NOW).patch).not.toHaveProperty("passedAt");
  });

  it("burns at stage 9: burned_at now and no next review", () => {
    const { patch, review } = applyReview(assignment(8, { passedAt: 1 }), 0, 0, NOW);
    expect(patch).toEqual({ srsStage: 9, availableAt: null, burnedAt: NOW.getTime() });
    expect(review.endingStage).toBe(9);
  });

  it("records the wrong counts in the review", () => {
    expect(applyReview(assignment(5), 2, 1, NOW).review).toMatchObject({
      startingStage: 5,
      endingStage: 1,
      incorrectMeaningCount: 2,
      incorrectReadingCount: 1,
    });
  });
});
