import { describe, expect, it } from "vitest";

import { formatReport } from "./build";
import { buildLevels, KANJI_PER_LEVEL, retiredChanges } from "./levels";
import { indexJmdict, type JmdictIndex } from "./parse/jmdict";
import type { KanjiInfo } from "./parse/kanjidic";
import { commonWords, select, type SelectedKanji, type Selection } from "./select";

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
    const subjects = buildLevels(selection, []).subjects;
    const kanjiOrder = subjects.filter((s) => s.type === "kanji").map((s) => s.characters);
    expect(kanjiOrder).toEqual(["人", "上", "大", "体", "畑"]);
    expect(KANJI_PER_LEVEL).toBe(25);
  });

  it("puts radicals, then kanji, then vocab in a level, with positions from 1", () => {
    const subjects = buildLevels(selection, []).subjects;
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
    const subjects = buildLevels(many, []).subjects;
    const find = (type: string, c: string) =>
      subjects.find((s) => s.type === type && s.characters === c)!;
    expect(find("radical", "一").level).toBe(1);
    expect(find("radical", "火").level).toBe(2);
    expect(find("kanji", "畑").level).toBe(2);
    expect(find("vocab", "一畑").level).toBe(2);
  });

  it("links kanji to radical ids and vocab to kanji ids", () => {
    const subjects = buildLevels(selection, []).subjects;
    const id = (type: string, c: string) =>
      subjects.find((s) => s.type === type && s.characters === c)!.id;
    const jinTai = subjects.find((s) => s.characters === "人体")!;
    expect(jinTai.componentIds).toEqual([id("kanji", "人"), id("kanji", "体")]);
    const ue = subjects.find((s) => s.type === "kanji" && s.characters === "上")!;
    expect(ue.componentIds).toEqual([id("radical", "一"), id("radical", "卜")]);
  });

  it("keeps existing ids across builds and gives new items ids above the highest", () => {
    const first = buildLevels(selection, []).subjects;
    const grown: Selection = {
      ...selection,
      kanji: [kanji("一", 5, 1, ["一"]), ...selection.kanji],
    };
    const second = buildLevels(grown, first).subjects;
    for (const s of first) {
      const again = second.find((x) => x.type === s.type && x.characters === s.characters)!;
      expect(again.id).toBe(s.id);
    }
    const maxFirst = Math.max(...first.map((s) => s.id));
    expect(second.find((s) => s.type === "kanji" && s.characters === "一")!.id).toBe(maxFirst + 1);
    expect(new Set(second.map((s) => s.id)).size).toBe(second.length);
  });

  it("retires a dropped item, never reuses its id, and gives the id back when it returns", () => {
    const first = buildLevels(selection, []);
    expect(first.retired).toEqual([]);
    // 人体 is the last vocab, so it holds the highest id: the case that used to be reused.
    const jinTai = first.subjects.find((s) => s.characters === "人体")!;
    expect(jinTai.id).toBe(Math.max(...first.subjects.map((s) => s.id)));

    const swapped: Selection = {
      ...selection,
      vocab: [
        vocab("大人", 5, ["大", "人"]),
        vocab("上", 5, ["上"]),
        vocab("大体", 4, ["大", "体"]),
      ],
    };
    const second = buildLevels(swapped, first.subjects, first.retired);
    expect(second.retired).toEqual([{ id: jinTai.id, type: "vocab", characters: "人体" }]);
    expect(second.subjects.find((s) => s.characters === "大体")!.id).toBe(jinTai.id + 1);

    const third = buildLevels(selection, second.subjects, second.retired);
    expect(third.subjects.find((s) => s.characters === "人体")!.id).toBe(jinTai.id);
    expect(third.retired).toEqual([{ id: jinTai.id + 1, type: "vocab", characters: "大体" }]);
    expect(retiredChanges(second.retired, third.retired)).toEqual({
      retired: [{ id: jinTai.id + 1, type: "vocab", characters: "大体" }],
      restored: [{ id: jinTai.id, type: "vocab", characters: "人体" }],
    });
  });

  it("starts new ids above the highest retired id too", () => {
    const retired = [{ id: 99, type: "kanji" as const, characters: "外" }];
    const { subjects, retired: after } = buildLevels(selection, [], retired);
    expect(Math.min(...subjects.map((s) => s.id))).toBe(100);
    expect(after).toEqual(retired);
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
    const { subjects } = buildLevels(
      { ...empty, kanji: [kanji("人", 5, 1, ["人"])], vocab: [] },
      [],
    );
    const report = formatReport({
      subjects,
      selection: {
        ...empty,
        kanji: [],
        vocab: [],
        dropped: [{ front: "大切", back: "たいせつ", jlpt: 5, reason: "kanji outside the set" }],
      },
      license: "usable",
      noGlyph: ["⺌"],
      ids: {
        retired: [{ id: 7, type: "vocab", characters: "人体" }],
        restored: [],
      },
    });
    expect(report).toContain("JLPT source: tanos N5 to N3 lists (license confirmed usable).");
    expect(report).toContain("Vocab source: tanos N5 to N3 vocab lists: 0 words");
    expect(report).toContain("    1         1      1      0");
    expect(report).toContain("kanji outside the set (1): 大切【たいせつ】N5");
    expect(report).toContain("Components with no Noto Sans JP glyph (kept; review by hand): ⺌");
    expect(report).toContain("Retired by this build (1): vocab:人体 (id 7)");
    expect(report).toContain("Restored by this build (0): none");
  });

  it("says when the fallbacks ran, with the license and the vocab count", () => {
    const report = formatReport({
      subjects: [],
      selection: { ...empty, kanji: [], vocab: [vocab("大人", 5, ["大", "人"])] },
      license: "unusable",
      noGlyph: [],
    });
    expect(report).toContain(
      'JLPT source: KANJIDIC2 old JLPT fallback (tanos license is "unusable").',
    );
    expect(report).toContain(
      'Vocab source: JMdict common words fallback (tanos license is "unusable"): 1 words',
    );
  });
});

describe("commonWords (vocab fallback)", () => {
  // A JMdict entry whose kanji and kana forms are all common unless said otherwise.
  const entry = (
    id: string,
    written: string,
    reading: string,
    { kanjiCommon = true, kanaCommon = true } = {},
  ) => ({
    id,
    kanji: [{ text: written, common: kanjiCommon, tags: [] }],
    kana: [{ text: reading, common: kanaCommon, tags: [], appliesToKanji: ["*"] }],
    sense: [
      { appliesToKanji: ["*"], appliesToKana: ["*"], gloss: [{ lang: "eng", text: written }] },
    ],
  });
  const index = indexJmdict({
    words: [
      entry("50", "人", "ひと"),
      entry("40", "人々", "ひとびと"),
      entry("30", "人が", "ひとが"),
      entry("20", "人だ", "ひとだ"),
      // An uncommon entry listed first: the index puts the common one first.
      entry("5", "大人", "だいにん", { kanjiCommon: false, kanaCommon: false }),
      entry("10", "大人", "おとな"),
      entry("60", "大", "だい"),
      entry("70", "大きい", "おおきい"),
      entry("80", "人間", "にんげん", { kanjiCommon: false }),
      entry("90", "大大", "だいだい", { kanaCommon: false }),
      entry("95", "大事", "だいじ"),
      entry("99", "ひと", "ひと"),
    ],
  });
  const course = [kanji("大", 4, 2, ["大"]), kanji("人", 5, 9, ["人"])];

  it("takes common words, at most 3 per kanji, each placed at its latest kanji", () => {
    expect(commonWords(course, index).map((v) => [v.characters, v.jlpt, v.kanji])).toEqual([
      // 人 comes first (N5). Shortest first, then the lowest JMdict id; 人々 is the 4th, cut.
      ["人", 5, ["人"]],
      ["人だ", 5, ["人"]],
      ["人が", 5, ["人"]],
      // 大人 waits for 大, its latest kanji, and takes the harder level of its kanji (N4).
      ["大", 4, ["大"]],
      ["大人", 4, ["大", "人"]],
      ["大きい", 4, ["大"]],
    ]);
  });

  it("reads meanings and readings through matchVocab on the common reading", () => {
    const otona = commonWords(course, index).find((v) => v.characters === "大人")!;
    expect(otona.readings).toEqual([{ text: "おとな", primary: true }]);
    expect(otona.meanings).toEqual([{ text: "大人", primary: true }]);
  });

  it("replaces the tanos vocab in select when the license is not usable", () => {
    const info = (literal: string): KanjiInfo => ({
      literal,
      meanings: [{ text: literal, primary: true }],
      readings: [],
      frequency: literal === "人" ? 9 : 2,
      oldJlpt: null,
    });
    const result = select({
      kanjiLevels: new Map([
        ["人", 5],
        ["大", 4],
      ]),
      vocabRows: [{ row: { front: "大切", back: "たいせつ" }, jlpt: 5 }],
      kanjidic: new Map([info("大"), info("人")].map((k) => [k.literal, k])),
      kradfile: new Map(),
      jmdict: index,
      vocabFallback: true,
    });
    expect(result.vocab.map((v) => v.characters)).toEqual([
      "人",
      "人だ",
      "人が",
      "大",
      "大人",
      "大きい",
    ]);
    expect(result.dropped).toEqual([]);
  });
});
