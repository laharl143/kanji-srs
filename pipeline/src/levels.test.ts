import { describe, expect, it } from "vitest";

import { formatReport } from "./build";
import { buildLevels, KANJI_PER_LEVEL } from "./levels";
import type { JmdictIndex } from "./parse/jmdict";
import type { KanjiInfo } from "./parse/kanjidic";
import { select, type SelectedKanji, type Selection } from "./select";

function kanji(
  literal: string,
  jlpt: 5 | 4 | 3,
  frequency: number | null,
  components: string[],
): SelectedKanji {
  return {
    literal,
    jlpt,
    frequency,
    components,
    oldJlpt: null,
    meanings: [{ text: literal, primary: true }],
    readings: [{ text: "x", kind: "onyomi", primary: true }],
  };
}

function vocab(characters: string, jlpt: 5 | 4 | 3, kanjiChars: string[]) {
  return {
    characters,
    jlpt,
    meanings: [{ text: characters, primary: true }],
    readings: [{ text: "y", primary: true }],
    kanji: kanjiChars,
  };
}

const empty: Omit<Selection, "kanji" | "vocab"> = {
  dropped: [],
  missingKanji: [],
  noComponents: [],
};

describe("buildLevels", () => {
  const selection: Selection = {
    ...empty,
    kanji: [
      kanji("体", 4, 88, ["化", "一", "木"]),
      kanji("人", 5, 5, ["人"]),
      kanji("上", 5, 35, ["一", "卜"]),
      kanji("畑", 3, null, ["火", "田"]),
      kanji("大", 5, null, ["大"]),
    ],
    vocab: [vocab("大人", 5, ["大", "人"]), vocab("人体", 4, ["人", "体"]), vocab("上", 5, ["上"])],
  };

  it("orders kanji by JLPT then frequency (missing last) and packs them into levels", () => {
    const subjects = buildLevels(selection, []);
    const kanjiOrder = subjects.filter((s) => s.type === "kanji").map((s) => s.characters);
    expect(kanjiOrder).toEqual(["人", "上", "大", "体", "畑"]);
    expect(KANJI_PER_LEVEL).toBe(25);
  });

  it("puts radicals, then kanji, then vocab in a level, with positions from 1", () => {
    const subjects = buildLevels(selection, []);
    expect(subjects.map((s) => `${s.type}:${s.characters}:${s.position}`)).toEqual([
      "radical:人:1",
      "radical:一:2",
      "radical:卜:3",
      "radical:大:4",
      "radical:化:5",
      "radical:木:6",
      "radical:火:7",
      "radical:田:8",
      "kanji:人:1",
      "kanji:上:2",
      "kanji:大:3",
      "kanji:体:4",
      "kanji:畑:5",
      "vocab:上:1",
      "vocab:大人:2",
      "vocab:人体:3",
    ]);
  });

  it("places radicals at their first kanji's level and vocab at its latest kanji's level", () => {
    const many: Selection = {
      ...empty,
      kanji: [
        ...Array.from({ length: KANJI_PER_LEVEL }, (_, i) =>
          kanji(String.fromCodePoint(0x4e00 + i), 5, i + 1, ["一"]),
        ),
        kanji("畑", 4, 1, ["火", "一"]),
      ],
      vocab: [vocab("一畑", 5, [String.fromCodePoint(0x4e00), "畑"])],
    };
    const subjects = buildLevels(many, []);
    const find = (type: string, c: string) =>
      subjects.find((s) => s.type === type && s.characters === c)!;
    expect(find("radical", "一").level).toBe(1);
    expect(find("radical", "火").level).toBe(2);
    expect(find("kanji", "畑").level).toBe(2);
    expect(find("vocab", "一畑").level).toBe(2);
  });

  it("links kanji to radical ids and vocab to kanji ids", () => {
    const subjects = buildLevels(selection, []);
    const id = (type: string, c: string) =>
      subjects.find((s) => s.type === type && s.characters === c)!.id;
    const jinTai = subjects.find((s) => s.characters === "人体")!;
    expect(jinTai.componentIds).toEqual([id("kanji", "人"), id("kanji", "体")]);
    const ue = subjects.find((s) => s.type === "kanji" && s.characters === "上")!;
    expect(ue.componentIds).toEqual([id("radical", "一"), id("radical", "卜")]);
  });

  it("keeps existing ids across builds and gives new items ids above the highest", () => {
    const first = buildLevels(selection, []);
    const grown: Selection = {
      ...selection,
      kanji: [kanji("一", 5, 1, ["一"]), ...selection.kanji],
    };
    const second = buildLevels(grown, first);
    for (const s of first) {
      const again = second.find((x) => x.type === s.type && x.characters === s.characters)!;
      expect(again.id).toBe(s.id);
    }
    const maxFirst = Math.max(...first.map((s) => s.id));
    expect(second.find((s) => s.type === "kanji" && s.characters === "一")!.id).toBe(maxFirst + 1);
    expect(new Set(second.map((s) => s.id)).size).toBe(second.length);
  });
});

describe("select", () => {
  const info = (literal: string): KanjiInfo => ({
    literal,
    meanings: [{ text: literal, primary: true }],
    readings: [],
    frequency: 1,
    oldJlpt: null,
  });
  const jmdict: JmdictIndex = new Map([
    [
      "大人",
      [
        {
          id: "1",
          kanji: [{ text: "大人", common: true, tags: [] }],
          kana: [{ text: "おとな", common: true, tags: [], appliesToKanji: ["*"] }],
          sense: [
            {
              appliesToKanji: ["*"],
              appliesToKana: ["*"],
              gloss: [{ lang: "eng", text: "adult" }],
            },
          ],
        },
      ],
    ],
  ]);

  it("keeps words whose kanji are all in the set and reports why others are dropped", () => {
    const result = select({
      kanjiLevels: new Map([
        ["大", 5],
        ["人", 5],
        ["鬱", 3],
      ]),
      vocabRows: [
        { row: { front: "大人", back: "おとな" }, jlpt: 5 },
        { row: { front: "大人", back: "おとな" }, jlpt: 4 },
        { row: { front: "大切", back: "たいせつ" }, jlpt: 5 },
        { row: { front: "人", back: "にん" }, jlpt: 5 },
        { row: { front: "ここ", back: "ここ" }, jlpt: 5 },
      ],
      kanjidic: new Map([info("大"), info("人")].map((k) => [k.literal, k])),
      kradfile: new Map([["大", ["大"]]]),
      jmdict,
    });
    expect(result.vocab.map((v) => [v.characters, v.jlpt, v.kanji])).toEqual([
      ["大人", 5, ["大", "人"]],
    ]);
    expect(result.dropped.map((d) => `${d.front}:${d.reason}`)).toEqual([
      "大人:duplicate",
      "大切:kanji outside the set",
      "人:no JMdict match",
      "ここ:no kanji",
    ]);
    expect(result.missingKanji).toEqual(["鬱"]);
    expect(result.noComponents).toEqual(["人"]);
  });

  it("prints a build report with per level counts and drops", () => {
    const subjects = buildLevels({ ...empty, kanji: [kanji("人", 5, 1, ["人"])], vocab: [] }, []);
    const report = formatReport({
      subjects,
      selection: {
        ...empty,
        kanji: [],
        vocab: [],
        dropped: [{ front: "大切", back: "たいせつ", jlpt: 5, reason: "kanji outside the set" }],
      },
      usedFallback: false,
      noGlyph: ["⺌"],
    });
    expect(report).toContain("    1         1      1      0");
    expect(report).toContain("kanji outside the set (1): 大切【たいせつ】N5");
    expect(report).toContain("no Noto Sans JP glyph (kept; substitutes come in 0005): ⺌");
  });
});
