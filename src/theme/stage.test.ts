import { describe, expect, it } from "vitest";

import { stageClasses, stageGroup } from "./stage";

describe("stageGroup", () => {
  it.each([
    [null, "locked", "Locked"],
    [0, "lesson", "Lesson"],
    [1, "seed", "Seed"],
    [4, "seed", "Seed"],
    [5, "sprout", "Sprout"],
    [6, "sprout", "Sprout"],
    [7, "bloom", "Bloom"],
    [8, "harvest", "Harvest"],
    [9, "retired", "Retired"],
  ] as const)("maps %s to %s", (stage, group, label) => {
    expect(stageGroup(stage)).toEqual({ group, label });
  });

  it.each([10, -1, 2.5, Number.NaN])("throws for %s", (stage) => {
    expect(() => stageGroup(stage)).toThrow(/Invalid SRS stage/);
  });

  it("has a literal class for every group", () => {
    for (const stage of [null, 0, 1, 5, 7, 8, 9]) {
      expect(stageClasses[stageGroup(stage).group].bg).toMatch(/^bg-stage-[a-z]+$/);
    }
  });
});
