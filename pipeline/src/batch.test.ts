import { describe, expect, it } from "vitest";

import { course, kun, on, subject } from "../fixtures/course";
import { parseLevels, planBatches, type BatchFile } from "./batch";
import { subjectKey, type Content } from "./content";

const plan = (content: Content, levels: number[], pending = new Set<string>(), firstNumber = 1) =>
  planBatches(content, levels, pending, { firstNumber, createdAt: "2026-11-02T00:00:00.000Z" });

const keys = (files: BatchFile[]) => files.map((f) => f.items.map((i) => subjectKey(i)));

describe("planBatches", () => {
  it("plans radicals first and holds back kanji with unnamed radicals and vocab with unwritten kanji", () => {
    const { files, leftOut } = plan(course(), [2], new Set(), 7);
    expect(files.map((f) => f.batch)).toEqual([7, 8]);
    expect(keys(files)).toEqual([["radical:口", "radical:丨"], ["kanji:下"]]);
    expect(leftOut).toEqual([
      { subject: "kanji:中", level: 2, waitingFor: ["radical:口", "radical:丨"] },
      { subject: "vocab:中", level: 2, waitingFor: ["kanji:中"] },
      { subject: "vocab:上下", level: 2, waitingFor: ["kanji:下"] },
    ]);
    expect(files[0]).toMatchObject({ createdAt: "2026-11-02T00:00:00.000Z", levels: [2] });
  });

  it("skips written items and items already in an unmerged batch", () => {
    const c = course();
    c.mnemonics.radicals["口"] = { name: "hatch", meaningMnemonic: "A hatch." };
    expect(keys(plan(c, [2], new Set(["kanji:下"])).files)).toEqual([["radical:丨"]]);
  });

  it("lets a kanji in once its radicals have names, and a vocab once its kanji are written", () => {
    const c = course();
    c.mnemonics.radicals["口"] = { name: "hatch", meaningMnemonic: "A hatch." };
    c.mnemonics.radicals["丨"] = { name: "pole", meaningMnemonic: "A pole." };
    c.mnemonics.kanji["下"] = { meaningMnemonic: "Below.", readingMnemonic: "Car." };
    const { files, leftOut } = plan(c, [2]);
    expect(keys(files)).toEqual([["kanji:中"], ["vocab:上下"]]);
    expect(leftOut).toEqual([{ subject: "vocab:中", level: 2, waitingFor: ["kanji:中"] }]);
  });

  it("caps a file at 25 items, never mixes types, and orders by type, level, then position", () => {
    const c = course();
    for (let i = 0; i < 30; i++) {
      c.subjects.push(subject(100 + i, "radical", String.fromCodePoint(0x2f00 + i), 3, 31 - i));
    }
    const { files } = plan(c, [2, 3]);
    expect(files.map((f) => [f.items[0].type, f.items.length])).toEqual([
      ["radical", 25],
      ["radical", 8],
      ["kanji", 1],
    ]);
    expect(files.every((f) => new Set(f.items.map((i) => i.type)).size === 1)).toBe(true);
    // Level 2 radicals, then level 3 by position: 木 is at 1, the added ones count down from 31.
    expect(files[0].items.slice(0, 4).map((i) => i.characters)).toEqual([
      "口",
      "丨",
      "木",
      String.fromCodePoint(0x2f00 + 29),
    ]);
    expect(files.map((f) => f.batch)).toEqual([1, 2, 3]);
  });

  it("writes nothing once every item in the levels has a mnemonic", () => {
    const c = course();
    expect(plan(c, [1])).toEqual({ files: [], leftOut: [] });
  });

  it("gives a radical the first 5 kanji that use it, by level then position, and the full count", () => {
    const c = course();
    for (let i = 0; i < 6; i++) {
      c.subjects.push(
        subject(20 + i, "kanji", String.fromCodePoint(0x5400 + i), 3, 6 - i, {
          components: [5],
          readings: [on("こう")],
          meanings: [`meaning ${i}`],
        }),
      );
    }
    expect(plan(c, [2]).files[0].items[0]).toEqual({
      type: "radical",
      id: 5,
      characters: "口",
      level: 2,
      usedBy: [
        { characters: "中", meaning: "middle" },
        ...[5, 4, 3, 2].map((i) => ({
          characters: String.fromCodePoint(0x5400 + i),
          meaning: `meaning ${i}`,
        })),
      ],
      usedByCount: 7,
      name: "",
      meaningMnemonic: "",
    });
  });

  it("gives a kanji its meanings, readings as stored, radical names, and its sound hook", () => {
    const c = course();
    const empty = plan(c, [2]).files[1].items[0];
    expect(empty).toEqual({
      type: "kanji",
      id: 8,
      characters: "下",
      level: 2,
      meanings: ["below", "down"],
      readings: [on("か"), on("げ"), kun("した")],
      radicals: [
        { characters: "一", name: "plank" },
        { characters: "卜", name: "fortune stick" },
      ],
      soundHook: { reading: "か", hook: "" },
      meaningMnemonic: "",
      readingMnemonic: "",
    });
    c.soundHooks["か"] = "car";
    expect(plan(c, [2]).files[1].items[0]).toMatchObject({
      soundHook: { reading: "か", hook: "car" },
    });
  });

  it("gives a vocab its texts primary first, and its kanji with their hooks (null when none)", () => {
    const c = course();
    c.mnemonics.kanji["下"] = { meaningMnemonic: "Below.", readingMnemonic: "Car." };
    c.subjects[9].readings = [
      { text: "うえした", primary: false },
      { text: "じょうげ", primary: true },
    ];
    const vocab = plan(c, [2]).files.find((f) => f.items[0].type === "vocab")!.items[0];
    expect(vocab).toEqual({
      type: "vocab",
      id: 10,
      characters: "上下",
      level: 2,
      meanings: ["top and bottom"],
      readings: ["じょうげ", "うえした"],
      kanji: [
        { characters: "上", meaning: "above", readings: ["じょう", "うえ"], hook: "joker" },
        { characters: "下", meaning: "below", readings: ["か", "げ", "した"], hook: null },
      ],
      meaningMnemonic: "",
      readingMnemonic: "",
    });
  });
});

describe("parseLevels", () => {
  it("takes N or A-B between 1 and the highest level", () => {
    expect(parseLevels("2", 25)).toEqual([2]);
    expect(parseLevels("2-3", 25)).toEqual([2, 3]);
    expect(parseLevels("1-25", 25)).toHaveLength(25);
  });

  it("rejects anything else", () => {
    for (const bad of [undefined, "", "0", "26", "3-2", "2-26", "two", "2,3", "-1", "2-", " 2"]) {
      expect(parseLevels(bad, 25)).toBeNull();
    }
  });
});
