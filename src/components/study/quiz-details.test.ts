import { describe, expect, it } from "vitest";

import { cardDetails, cardMeanings, detailsFor } from "./quiz-details";

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

describe("cardDetails (spec 0012 AC-4)", () => {
  it("gives the meaning part then the reading part, dropping empty ones", () => {
    expect(cardDetails("kanji", details)).toEqual([
      { mnemonic: "meaning story", note: null, noteLabel: "Your meaning note" },
      { mnemonic: null, note: "my reading note", noteLabel: "Your reading note" },
    ]);
    expect(cardDetails("kanji", { ...details, readingNote: null })).toHaveLength(1);
  });

  it("leaves the reading part out for radicals, and is empty when nothing is there", () => {
    expect(cardDetails("radical", details)).toEqual([
      { mnemonic: "meaning story", note: null, noteLabel: "Your meaning note" },
    ]);
    expect(
      cardDetails("kanji", {
        meaningMnemonic: "",
        readingMnemonic: null,
        meaningNote: null,
        readingNote: null,
      }),
    ).toEqual([]);
  });
});

describe("cardMeanings (spec 0012 AC-4)", () => {
  it("puts primary meanings first, then the others, then your synonyms", () => {
    const subject = {
      type: "kanji" as const,
      meanings: [
        { text: "Dirt", primary: false },
        { text: "Ground", primary: true },
      ],
      readings: [],
    };
    expect(cardMeanings(subject, ["earth"])).toEqual(["Ground", "Dirt", "earth"]);
  });
});
