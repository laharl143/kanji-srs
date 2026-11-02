import { describe, expect, it } from "vitest";

import { progressFraction } from "./progress";

describe("progressFraction", () => {
  it("returns value over max", () => {
    expect(progressFraction(3, 4)).toBe(0.75);
  });

  it("is 0 when max is 0 or less", () => {
    expect(progressFraction(3, 0)).toBe(0);
    expect(progressFraction(3, -2)).toBe(0);
  });

  it("clamps negative values to 0", () => {
    expect(progressFraction(-5, 10)).toBe(0);
  });

  it("clamps values over max to 1", () => {
    expect(progressFraction(15, 10)).toBe(1);
  });
});
