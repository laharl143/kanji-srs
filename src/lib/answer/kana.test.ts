import { describe, expect, it } from "vitest";

import { finishReadingInput, toReadingInput } from "./kana";

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
