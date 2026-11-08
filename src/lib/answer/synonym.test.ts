import { describe, expect, it } from "vitest";

import { checkSynonym, cleanSynonym, synonymRefusalMessage } from "./synonym";

const large = [
  { text: "Large", primary: true },
  { text: "Big", primary: false },
];
const run = [{ text: "to run", primary: true }];

describe("cleanSynonym", () => {
  it("trims and collapses inner spaces", () => {
    expect(cleanSynonym("  big   guy \t")).toBe("big guy");
  });
});

describe("checkSynonym", () => {
  it("accepts a new English meaning, cleaned", () => {
    expect(checkSynonym("  big   guy ", large, [])).toEqual({ ok: true, value: "big guy" });
    expect(checkSynonym("huge", large, [])).toEqual({ ok: true, value: "huge" });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["!!!", "empty"],
    ["おおきい", "not_english"],
    ["big 大", "not_english"],
    ["a".repeat(65), "too_long"],
    ["Large ", "duplicate"],
    ["large", "duplicate"],
    ["BIG!", "duplicate"],
  ])("refuses %j as %s", (text, reason) => {
    expect(checkSynonym(text, large, [])).toEqual({ ok: false, reason });
  });

  it("accepts exactly 64 characters", () => {
    expect(checkSynonym("a".repeat(64), large, []).ok).toBe(true);
  });

  it("refuses a form that matches a current synonym", () => {
    expect(checkSynonym("huge", large, ["huge"])).toEqual({ ok: false, reason: "duplicate" });
    expect(checkSynonym("Huge!", large, ["huge"])).toEqual({ ok: false, reason: "duplicate" });
  });

  it("refuses 'run' when 'to run' is a meaning, and 'to large' against 'large'", () => {
    expect(checkSynonym("run", run, [])).toEqual({ ok: false, reason: "duplicate" });
    expect(checkSynonym("to large", large, [])).toEqual({ ok: false, reason: "duplicate" });
  });

  it("refuses a ninth synonym", () => {
    const eight = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];
    expect(checkSynonym("huge", large, eight)).toEqual({ ok: false, reason: "full" });
    expect(checkSynonym("huge", large, eight.slice(0, 7)).ok).toBe(true);
  });

  it("has a message for every reason", () => {
    expect(synonymRefusalMessage.duplicate).toBe("Already accepted");
    expect(synonymRefusalMessage.not_english).toBe("Type an English meaning");
    expect(synonymRefusalMessage.empty).toBe("Type an English meaning");
    expect(synonymRefusalMessage.too_long).toBe("Use 64 characters or fewer");
    expect(synonymRefusalMessage.full).toBe("You can add up to 8 synonyms");
  });
});
