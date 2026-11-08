import { describe, expect, it } from "vitest";

import bundle from "../../../content/bundle.json";
import type { Meaning, Reading, SubjectType } from "@/lib/types";

import { acceptedAnswers, checkMeaning, checkReading } from "./check";
import { finishReadingInput, toReadingInput } from "./kana";
import { buildCourseForms } from "./meaning";

type S = { type: SubjectType; meanings: Meaning[]; readings: Reading[] };
const subject = (type: SubjectType, meanings: string[], readings: Reading[] = []): S => ({
  type,
  meanings: meanings.map((text, i) => ({ text, primary: i === 0 })),
  readings,
});
const none = new Set<string>();
const meaning = (input: string, s: S, synonyms: string[] = [], course = none) =>
  checkMeaning(input, s, synonyms, course);

// 上: on'yomi primary, kun'yomi alternates (as in the bundle).
const ue: S = {
  type: "kanji",
  meanings: [
    { text: "above", primary: true },
    { text: "up", primary: false },
  ],
  readings: [
    { text: "じょう", kind: "onyomi", primary: true },
    { text: "しょう", kind: "onyomi", primary: true },
    { text: "うえ", kind: "kunyomi", primary: false },
  ],
};

describe("checkMeaning: forms and normalization (AC-1)", () => {
  const allDay = subject("vocab", ["all day (long)"]);
  const goOut = subject("vocab", ["to go out (e.g. on an excursion or outing)"]);

  it("makes brackets, case, and hyphens optional", () => {
    for (const input of ["All Day", "all day long", "ALL-DAY", "  all   day (long)! "]) {
      expect(meaning(input, allDay)).toEqual({ result: "correct" });
    }
  });

  it("makes a leading 'to' optional on both sides", () => {
    expect(meaning("go out", goOut)).toEqual({ result: "correct" });
    expect(meaning("to go out", goOut)).toEqual({ result: "correct" });
    expect(meaning("to one", subject("kanji", ["one"]))).toEqual({ result: "correct" });
  });

  it("drops accents and reads full width letters as plain", () => {
    expect(meaning("ritsuryo", subject("vocab", ["ritsuryō"]))).toEqual({ result: "correct" });
    expect(meaning("ｏｎｅ", subject("kanji", ["one"]))).toEqual({ result: "correct" });
  });

  it("never treats a digit as its number word", () => {
    expect(meaning("3", subject("kanji", ["three"]))).toEqual({ result: "wrong" });
  });

  it("leaves an unclosed bracket alone", () => {
    expect(meaning("each", subject("kanji", ["each (person"]))).toEqual({ result: "wrong" });
    expect(meaning("each person", subject("kanji", ["each (person"]))).toEqual({
      result: "correct",
    });
  });

  it("is empty when nothing is left after normalization (AC-10)", () => {
    expect(meaning("?!", ue)).toEqual({ result: "empty" });
    expect(meaning("   ", ue)).toEqual({ result: "empty" });
  });
});

describe("checkMeaning: typo tolerance (AC-2)", () => {
  // [accepted form, inside the limit, one past the limit]
  const cases: [string, string, string][] = [
    ["cat", "cat", "cot"], // length 3: no edits
    ["four", "fuur", "fuux"], // 4: 1 edit
    ["above", "abuve", "abxxe"], // 5: 1
    ["animal", "anxmxl", "axxmxl"], // 6: 2
    ["direction", "dirxctixn", "dxrxctixn"], // 9: 2
    ["government", "govxrnmxnt", "gxvxrnmxnt"], // 10: 2
    ["international", "intxrnxtixnal", "xntxrnxtixnal"], // 13: 3
  ];
  it.each(cases)("%s: close inside the limit, wrong one past it", (form, inside, past) => {
    const s = subject("vocab", [form]);
    expect(meaning(inside, s).result).toBe(form === inside ? "correct" : "close");
    expect(meaning(past, s)).toEqual({ result: "wrong" });
  });

  it("counts a swap of neighboring letters as one edit", () => {
    expect(meaning("foru", subject("kanji", ["four"]))).toEqual({
      result: "close",
      expected: "four",
    });
  });

  it("needs the same digits in the same order", () => {
    expect(meaning("30 years old", subject("vocab", ["20 years old"]))).toEqual({
      result: "wrong",
    });
  });

  it("names the nearest meaning, then a primary one, then list order", () => {
    const s = subject("vocab", ["bright", "light"]);
    expect(meaning("lighr", s)).toEqual({ result: "close", expected: "light" });
    expect(meaning("moung", subject("vocab", ["mount", "mound"]))).toEqual({
      result: "close",
      expected: "mount",
    });
    expect(meaning("moun", subject("vocab", ["hill", "mount", "mound"]))).toEqual({
      result: "close",
      expected: "mount",
    });
    const synonymTie = subject("vocab", ["bread"]);
    expect(meaning("brea", synonymTie, ["break"])).toEqual({ result: "close", expected: "bread" });
  });
});

describe("checkMeaning: course word guard (AC-3)", () => {
  const course = buildCourseForms(bundle.subjects.map((s) => s.meanings as Meaning[]));
  const byChars = (c: string, type: SubjectType) =>
    bundle.subjects.find((s) => s.characters === c && s.type === type) as unknown as S;
  const three = byChars("三", "kanji");

  it("marks another course word wrong, while a real typo stays close", () => {
    expect(meaning("tree", three, [], course)).toEqual({ result: "wrong" });
    expect(meaning("thre", three, [], course)).toEqual({ result: "close", expected: "three" });
  });

  it("keeps an exact match correct even though it is a course form", () => {
    expect(meaning("three", three, [], course)).toEqual({ result: "correct" });
  });

  it("accepts a meaning several subjects share for each of them", () => {
    expect(meaning("tree", byChars("木", "kanji"), [], course)).toEqual({ result: "correct" });
    expect(meaning("tree", byChars("木", "vocab"), [], course)).toEqual({ result: "correct" });
  });

  it("guards the input without its leading 'to' too", () => {
    expect(meaning("to tree", three, [], course)).toEqual({ result: "wrong" });
  });
});

describe("checkMeaning: script and synonyms (AC-6, AC-12)", () => {
  it("asks for English when the meaning holds Japanese", () => {
    expect(meaning("ひ", ue)).toEqual({ result: "invalid", wanted: "english" });
    expect(meaning("が", ue)).toEqual({ result: "invalid", wanted: "english" });
    expect(meaning("ｶ", ue)).toEqual({ result: "invalid", wanted: "english" });
  });

  it("accepts your synonyms, with typo tolerance", () => {
    const day = subject("kanji", ["day", "sun"]);
    expect(meaning("sunshine", day, ["sunshine"])).toEqual({ result: "correct" });
    expect(meaning("sunshin", day, ["sunshine"])).toEqual({
      result: "close",
      expected: "sunshine",
    });
  });
});

describe("checkReading (AC-4 to AC-6)", () => {
  const kyuu = subject("kanji", ["nine"], [{ text: "きゅう", kind: "onyomi", primary: true }]);

  it("reads katakana, half width katakana, and long vowel marks as hiragana", () => {
    for (const input of ["キュウ", "キュー", "ｷｭｳ", finishReadingInput(toReadingInput("kyu-"))]) {
      expect(checkReading(input, kyuu)).toEqual({ result: "correct" });
    }
  });

  it("accepts primary readings only for a kanji, every reading for a vocab item", () => {
    expect(checkReading("じょう", ue)).toEqual({ result: "correct" });
    const japan = subject(
      "vocab",
      ["Japan"],
      [
        { text: "にっぽん", primary: true },
        { text: "にほん", primary: false },
      ],
    );
    expect(checkReading("にほん", japan)).toEqual({ result: "correct" });
    expect(checkReading("にっぽん", japan)).toEqual({ result: "correct" });
    expect(checkReading("にち", japan)).toEqual({ result: "wrong" });
  });

  it("hints at the wanted kind when a kanji gets its other kind of reading", () => {
    expect(checkReading("うえ", ue)).toEqual({ result: "wrong_kind", wanted: "onyomi" });
    expect(checkReading("ウエ", ue)).toEqual({ result: "wrong_kind", wanted: "onyomi" });
    expect(checkReading("した", ue)).toEqual({ result: "wrong" });
  });

  it("asks for kana when anything but hiragana is left", () => {
    for (const input of ["kyx", "日", "1", "ー", "じょう!"]) {
      expect(checkReading(input, ue)).toEqual({ result: "invalid", wanted: "kana" });
    }
  });

  it("is empty for blank input", () => {
    expect(checkReading("  ", ue)).toEqual({ result: "empty" });
  });
});

describe("acceptedAnswers (AC-11)", () => {
  it("lists every meaning, then your synonyms", () => {
    expect(acceptedAnswers("meaning", ue, ["over"])).toEqual(["above", "up", "over"]);
  });

  it("lists a kanji's primary readings, or every vocab reading with the primary first", () => {
    expect(acceptedAnswers("reading", ue, [])).toEqual(["じょう", "しょう"]);
    const japan = subject(
      "vocab",
      ["Japan"],
      [
        { text: "にほん", primary: false },
        { text: "にっぽん", primary: true },
      ],
    );
    expect(acceptedAnswers("reading", japan, [])).toEqual(["にっぽん", "にほん"]);
  });
});
