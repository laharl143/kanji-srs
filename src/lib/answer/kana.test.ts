import { describe, expect, it } from "vitest";

import { finishReadingInput, isHiraganaOnly, normalizeReading, toReadingInput } from "./kana";

describe("reading input", () => {
  it("turns romaji into hiragana as you type, holding a trailing n", () => {
    expect(toReadingInput("jou")).toBe("じょう");
    expect(toReadingInput("kan")).toBe("かn");
    expect(toReadingInput("kanji")).toBe("かんじ");
  });

  it("never produces katakana from a capital letter", () => {
    expect(toReadingInput("Jou")).toBe("じょう");
  });

  it("finishes a trailing n as ん on submit", () => {
    expect(finishReadingInput("かn")).toBe("かん");
    expect(finishReadingInput("じょう")).toBe("じょう");
  });
});

describe("normalizeReading", () => {
  it("turns katakana, half width katakana, and long vowel marks into plain hiragana", () => {
    expect(normalizeReading("キュー")).toBe("きゅう");
    expect(normalizeReading("ｷｭｳ")).toBe("きゅう");
    expect(normalizeReading("きゅー")).toBe("きゅう");
    expect(normalizeReading("ねー")).toBe("ねえ");
    expect(normalizeReading(" じょう　")).toBe("じょう");
  });

  it("leaves romaji and a ー with no kana before it alone", () => {
    expect(normalizeReading("kyx")).toBe("kyx");
    expect(normalizeReading("ー")).toBe("ー");
    expect(isHiraganaOnly("ー")).toBe(false);
    expect(isHiraganaOnly("きゅう")).toBe(true);
    expect(isHiraganaOnly("")).toBe(false);
  });
});
