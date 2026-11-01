import { describe, expect, it } from "vitest";

import { primaryMeaning } from "./subjects";

describe("primaryMeaning", () => {
  it("returns the primary meaning even when it is not first", () => {
    expect(
      primaryMeaning([
        { text: "adult", primary: false },
        { text: "grown up", primary: true },
      ]),
    ).toBe("grown up");
  });

  it("falls back to the first meaning when none is primary", () => {
    expect(
      primaryMeaning([
        { text: "big", primary: false },
        { text: "large", primary: false },
      ]),
    ).toBe("big");
  });

  it("returns an empty string for an empty list", () => {
    expect(primaryMeaning([])).toBe("");
  });
});
