import { describe, expect, it } from "vitest";

import { detailsFor } from "./quiz-details";

const details = {
  meaningMnemonic: "meaning story",
  readingMnemonic: null,
  meaningNote: null,
  readingNote: "my reading note",
};

describe("detailsFor", () => {
  it("picks the mnemonic and note for the question's kind", () => {
    expect(detailsFor("meaning", details)).toEqual({ mnemonic: "meaning story", note: null });
    expect(detailsFor("reading", details)).toEqual({ mnemonic: null, note: "my reading note" });
  });

  it("returns null when that kind has neither, so the toggle hides", () => {
    expect(detailsFor("reading", { ...details, readingNote: null })).toBeNull();
    expect(detailsFor("meaning", { ...details, meaningMnemonic: "" })).toBeNull();
  });
});
