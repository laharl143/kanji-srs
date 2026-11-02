import { describe, expect, it } from "vitest";

import { acceptedAnswers, checkMeaning, checkReading } from "./check";

const kanji = {
  meanings: [
    { text: "Above", primary: true },
    { text: "up", primary: false },
  ],
  readings: [
    { text: "じょう", kind: "onyomi" as const, primary: true },
    { text: "しょう", kind: "onyomi" as const, primary: true },
    { text: "うえ", kind: "kunyomi" as const, primary: false },
  ],
};

describe("checkMeaning", () => {
  it("accepts any meaning, ignoring case and surrounding spaces", () => {
    expect(checkMeaning("above", kanji)).toBe("correct");
    expect(checkMeaning("  UP ", kanji)).toBe("correct");
  });

  it("is exact otherwise", () => {
    expect(checkMeaning("abov", kanji)).toBe("wrong");
    expect(checkMeaning("go up", kanji)).toBe("wrong");
    expect(checkMeaning("   ", kanji)).toBe("wrong");
  });
});

describe("checkReading", () => {
  it("accepts a primary reading only", () => {
    expect(checkReading("じょう", kanji)).toBe("correct");
    expect(checkReading(" しょう ", kanji)).toBe("correct");
    expect(checkReading("うえ", kanji)).toBe("wrong");
  });

  it("does not accept katakana or empty input (exact until 0007)", () => {
    expect(checkReading("ジョウ", kanji)).toBe("wrong");
    expect(checkReading("", kanji)).toBe("wrong");
  });
});

describe("acceptedAnswers", () => {
  it("lists every meaning, or the primary readings only", () => {
    expect(acceptedAnswers("meaning", kanji)).toEqual(["Above", "up"]);
    expect(acceptedAnswers("reading", kanji)).toEqual(["じょう", "しょう"]);
  });
});
