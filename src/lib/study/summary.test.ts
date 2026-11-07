import { describe, expect, it } from "vitest";

import type { ReviewResult } from "./reviews";
import {
  describeChange,
  stageChange,
  stageName,
  summarizeReviews,
  type SavedReview,
} from "./summary";

function saved(
  subjectId: number,
  wrong: number,
  result: Partial<ReviewResult> & { startingStage: number; newStage: number },
): SavedReview {
  return {
    item: { subjectId, wrongMeaning: wrong, wrongReading: 0 },
    result: { ok: true, unlocked: 0, newLevel: null, ...result },
  };
}

describe("stage names (spec 0006 AC-9)", () => {
  it("names each stage from the stage table", () => {
    expect([0, 1, 4, 5, 6, 7, 8, 9].map(stageName)).toEqual([
      "Lesson",
      "Seed 1",
      "Seed 4",
      "Sprout 1",
      "Sprout 2",
      "Bloom",
      "Harvest",
      "Retired",
    ]);
    expect(() => stageName(10)).toThrow();
  });

  it("marks a change up or down, says it in words, and says when the stage stayed", () => {
    expect(stageChange(4, 5)).toEqual({ from: "Seed 4", to: "Sprout 1", direction: "up" });
    expect(describeChange(stageChange(4, 5))).toBe("Moved up from Seed 4 to Sprout 1");
    expect(describeChange(stageChange(6, 4))).toBe("Moved down from Sprout 2 to Seed 4");
    // A wrong answer at Seed 1 cannot go lower.
    expect(stageChange(1, 1).direction).toBe("same");
    expect(describeChange(stageChange(1, 1))).toBe("Stayed at Seed 1");
  });
});

describe("summarizeReviews (spec 0006 AC-9)", () => {
  it("splits correct and incorrect items, each in the order they finished", () => {
    const summary = summarizeReviews([
      saved(3, 0, { startingStage: 4, newStage: 5 }),
      saved(1, 2, { startingStage: 6, newStage: 4 }),
      saved(2, 0, { startingStage: 1, newStage: 2 }),
      saved(4, 1, { startingStage: 1, newStage: 1 }),
    ]);
    expect(summary.saved).toBe(4);
    expect(summary.correct.map((e) => e.subjectId)).toEqual([3, 2]);
    expect(summary.incorrect.map((e) => e.subjectId)).toEqual([1, 4]);
    expect(summary.incorrect[1].change.direction).toBe("same");
  });

  it("counts a wrong reading as incorrect too", () => {
    const summary = summarizeReviews([
      {
        item: { subjectId: 1, wrongMeaning: 0, wrongReading: 1 },
        result: { ok: true, startingStage: 2, newStage: 1, unlocked: 0, newLevel: null },
      },
    ]);
    expect(summary.correct).toEqual([]);
    expect(summary.incorrect.map((e) => e.subjectId)).toEqual([1]);
  });

  it("takes the highest level opened and adds up the unlocks", () => {
    const summary = summarizeReviews([
      saved(1, 0, { startingStage: 4, newStage: 5, unlocked: 5 }),
      saved(2, 0, { startingStage: 4, newStage: 5, unlocked: 27, newLevel: 2 }),
      saved(3, 0, { startingStage: 4, newStage: 5, unlocked: 1 }),
      saved(4, 0, { startingStage: 4, newStage: 5, unlocked: 3, newLevel: 3 }),
    ]);
    expect(summary.levelUp).toBe(3);
    expect(summary.newLessons).toBe(36);
  });

  it("has no banner and no unlocks when nothing changed, and nothing at all with 0 saved", () => {
    const one = summarizeReviews([saved(1, 0, { startingStage: 1, newStage: 2 })]);
    expect(one.levelUp).toBeNull();
    expect(one.newLessons).toBe(0);
    expect(summarizeReviews([])).toEqual({
      saved: 0,
      correct: [],
      incorrect: [],
      levelUp: null,
      newLessons: 0,
    });
  });
});
