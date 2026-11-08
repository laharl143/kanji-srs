import { describe, expect, it } from "vitest";

import { editDistance } from "./distance";
import {
  buildCourseForms,
  digitsOf,
  hasJapaneseScript,
  inputForms,
  meaningForms,
  normalizeMeaning,
  tolerance,
} from "./meaning";

describe("editDistance", () => {
  it("counts inserts, deletes, substitutions, and neighbor swaps as one edit each", () => {
    expect(editDistance("four", "four")).toBe(0);
    expect(editDistance("four", "foru")).toBe(1);
    expect(editDistance("four", "fours")).toBe(1);
    expect(editDistance("four", "for")).toBe(1);
    expect(editDistance("four", "fuor")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("ca", "abc")).toBe(3);
  });
});

describe("meaning forms", () => {
  it("normalizes case, accents, width, hyphens, slashes, and punctuation", () => {
    expect(normalizeMeaning("  Ritsuryō-Era / Ｌaw!? ")).toBe("ritsuryo era law");
  });

  it("builds up to four forms from one meaning", () => {
    expect(meaningForms("to go out (e.g. on an outing)")).toEqual([
      "to go out eg on an outing",
      "go out eg on an outing",
      "to go out",
      "go out",
    ]);
    expect(meaningForms("one")).toEqual(["one"]);
    expect(meaningForms("(...)")).toEqual([]);
  });

  it("keeps 'to' inside a word", () => {
    expect(inputForms("today")).toEqual(["today"]);
    expect(inputForms("To Eat")).toEqual(["to eat", "eat"]);
  });

  it("collects every form of every subject", () => {
    const forms = buildCourseForms([
      [{ text: "all day (long)", primary: true }],
      [{ text: "to eat", primary: true }],
    ]);
    expect([...forms].sort()).toEqual(["all day", "all day long", "eat", "to eat"]);
  });

  it("has the AC-2 tolerance table", () => {
    expect([1, 3, 4, 5, 6, 9, 10, 13, 16].map(tolerance)).toEqual([0, 0, 1, 1, 2, 2, 2, 3, 4]);
  });

  it("finds Japanese script and digits", () => {
    expect(hasJapaneseScript("tree 木")).toBe(true);
    expect(hasJapaneseScript("々")).toBe(true);
    expect(hasJapaneseScript("café")).toBe(false);
    expect(digitsOf("20 years 1 day")).toBe("201");
  });
});
