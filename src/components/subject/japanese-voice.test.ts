import { describe, expect, it } from "vitest";

import { findJapaneseVoice } from "./japanese-voice";

describe("findJapaneseVoice", () => {
  it("returns the first voice whose language starts with ja", () => {
    expect(
      findJapaneseVoice([
        { identifier: "en-us-x-sfg", language: "en-US" },
        { identifier: "ja-jp-x-htm", language: "ja-JP" },
        { identifier: "ja-jp-x-jab", language: "ja-JP" },
      ]),
    ).toBe("ja-jp-x-htm");
    expect(findJapaneseVoice([{ identifier: "j", language: "ja_JP" }])).toBe("j");
  });

  it("prefers an on device voice over a network voice, so speech works offline", () => {
    expect(
      findJapaneseVoice([
        { identifier: "ja-jp-x-htm-network", language: "ja-JP" },
        { identifier: "ja-jp-x-htm-local", language: "ja-JP" },
      ]),
    ).toBe("ja-jp-x-htm-local");
    expect(findJapaneseVoice([{ identifier: "ja-jp-x-htm-network", language: "ja-JP" }])).toBe(
      "ja-jp-x-htm-network",
    );
  });

  it("returns null with no Japanese voice", () => {
    expect(findJapaneseVoice([])).toBeNull();
    expect(findJapaneseVoice([{ identifier: "x", language: "jv-ID" }])).toBeNull();
  });
});
