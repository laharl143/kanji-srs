import { describe, expect, it } from "vitest";

import { checkAnswer, initialAnswer, type CheckableSubject } from "./answer-state";
import { synonymSheetTitle, withSynonyms } from "./session-synonyms";

// 丶, named "speck".
const speck: CheckableSubject & { id: number } = {
  id: 1,
  type: "radical",
  meanings: [{ text: "speck", primary: true }],
  readings: [],
  synonyms: [],
};
const ground: CheckableSubject & { id: number } = {
  ...speck,
  id: 2,
  meanings: [{ text: "ground", primary: true }],
};
const none = new Set<string>();

describe("withSynonyms (spec 0011 AC-4, AC-5)", () => {
  it("replaces only that subject's synonyms", () => {
    const byId = new Map([
      [1, speck],
      [2, ground],
    ]);
    const next = withSynonyms(byId, 1, ["swoosh"]);
    expect(next.get(1)?.synonyms).toEqual(["swoosh"]);
    expect(next.get(2)).toBe(ground);
    expect(byId.get(1)?.synonyms).toEqual([]);
  });

  it("returns the same map for an unknown subject", () => {
    const byId = new Map([[1, speck]]);
    expect(withSynonyms(byId, 9, ["swoosh"])).toBe(byId);
  });

  it("lets the next check accept the new synonym, and a removed one stops counting", () => {
    const typed = { ...initialAnswer, input: "swoosh" };
    const byId = new Map([[1, speck]]);
    expect(checkAnswer(typed, "meaning", byId.get(1)!, none).state.verdict).toBe("wrong");
    const added = withSynonyms(byId, 1, ["swoosh"]);
    expect(checkAnswer(typed, "meaning", added.get(1)!, none).state.verdict).toBe("correct");
    const removed = withSynonyms(added, 1, []);
    expect(checkAnswer(typed, "meaning", removed.get(1)!, none).state.verdict).toBe("wrong");
  });
});

describe("synonymSheetTitle (spec 0011 AC-1)", () => {
  it("names the item by its characters", () => {
    expect(synonymSheetTitle("行")).toBe("Your synonyms for 行");
  });

  it("says this radical when there are no characters", () => {
    expect(synonymSheetTitle("")).toBe("Your synonyms for this radical");
    expect(synonymSheetTitle(null)).toBe("Your synonyms for this radical");
  });
});
