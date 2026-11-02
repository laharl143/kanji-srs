import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { indexJmdict, matchVocab, type JmdictJson } from "./jmdict";
import { fallbackKanjiLevels, readAnkiDeck, tanosKanji, vocabCandidates } from "./jlpt";
import { kanjiReadings, parseKanjidic, type KanjidicJson } from "./kanjidic";
import { parseKradfile } from "./kradfile";

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(__dirname, "../../fixtures", name), "utf8")) as T;

describe("parseKanjidic", () => {
  const kanji = parseKanjidic(fixture<KanjidicJson>("kanjidic2.json"));

  it("strips okurigana and markers, converts to hiragana, and marks on'yomi primary", () => {
    expect(kanji.get("上")!.readings).toEqual([
      { text: "じょう", kind: "onyomi", primary: true },
      { text: "しょう", kind: "onyomi", primary: true },
      { text: "うえ", kind: "kunyomi", primary: false },
      { text: "あ", kind: "kunyomi", primary: false },
    ]);
  });

  it("marks kun'yomi primary when the kanji has no on'yomi", () => {
    expect(kanji.get("畑")!.readings.map((r) => [r.text, r.primary])).toEqual([
      ["はた", true],
      ["はたけ", true],
      ["ばたけ", true],
    ]);
  });

  it("keeps English meanings with the first one primary, plus frequency and old JLPT", () => {
    expect(kanji.get("上")).toMatchObject({
      meanings: [
        { text: "above", primary: true },
        { text: "up", primary: false },
      ],
      frequency: 35,
      oldJlpt: 4,
    });
  });

  it("copes with a character that has no readings or meanings", () => {
    expect(kanji.get("鬱")).toMatchObject({ meanings: [], readings: [], frequency: null });
  });

  it("removes duplicate readings across kinds", () => {
    expect(kanjiReadings(["ト"], ["と", "と.じる"]).map((r) => r.text)).toEqual(["と"]);
  });
});

describe("parseKradfile", () => {
  it("maps each kanji to its components without repeats, in file order", () => {
    const krad = parseKradfile(fixture("kradfile.json"));
    expect(krad.get("上")).toEqual(["一", "卜"]);
    expect(krad.get("体")).toEqual(["化", "一", "木"]);
  });
});

describe("matchVocab", () => {
  const index = indexJmdict(fixture<JmdictJson>("jmdict.json"));

  it("matches on written form plus reading and keeps up to 3 meanings that apply", () => {
    const match = matchVocab(index, "一日", "いちにち")!;
    expect(match.meanings.map((m) => m.text)).toEqual(["one day", "all day", "a day"]);
    expect(match.meanings[0].primary).toBe(true);
  });

  it("uses only senses that apply to the matched reading", () => {
    const match = matchVocab(index, "一日", "ついたち")!;
    expect(match.meanings.map((m) => m.text)).toEqual([
      "first day of the month",
      "a day",
      "some day",
    ]);
  });

  it("makes the matched reading primary and keeps other visible readings as not primary", () => {
    expect(matchVocab(index, "一日", "いちにち")!.readings).toEqual([
      { text: "いちにち", primary: true },
      { text: "ついたち", primary: false },
      { text: "いちじつ", primary: false },
    ]);
  });

  it("respects a reading restricted to other written forms", () => {
    expect(matchVocab(index, "大人", "おとな")).toBeDefined();
    expect(matchVocab(index, "大人しい", "おとな")).toBeUndefined();
  });

  it("prefers the common entry when two entries share a written form", () => {
    expect(matchVocab(index, "上", "うえ")!.jmdictId).toBe("4");
    expect(matchVocab(index, "上", "かみ")!.jmdictId).toBe("3");
  });

  it("returns undefined when nothing matches", () => {
    expect(matchVocab(index, "一日", "ひとつ")).toBeUndefined();
    expect(matchVocab(index, "二日", "ふつか")).toBeUndefined();
  });
});

describe("tanos decks", () => {
  const dir = mkdtempSync(join(tmpdir(), "tanos-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  // The two Anki 1.x tables the reader uses.
  function writeDeck(rows: [string, string][]): string {
    const path = join(dir, `deck-${Math.random()}.anki`);
    const db = new Database(path);
    db.exec(`CREATE TABLE fieldModels (id INTEGER PRIMARY KEY, name TEXT, ordinal INTEGER);
             CREATE TABLE fields (id INTEGER PRIMARY KEY, factId INTEGER, fieldModelId INTEGER, value TEXT);
             INSERT INTO fieldModels VALUES (1, 'Front', 0), (2, 'Back', 1);`);
    const insert = db.prepare("INSERT INTO fields (factId, fieldModelId, value) VALUES (?, ?, ?)");
    rows.forEach(([front, back], i) => {
      insert.run(i + 1, 1, front);
      insert.run(i + 1, 2, back);
    });
    db.close();
    return path;
  }

  it("reads front and back of every note", () => {
    const path = writeDeck([
      ["上", "above/up"],
      ["人", "person"],
    ]);
    expect(readAnkiDeck(path)).toEqual([
      { front: "上", back: "above/up" },
      { front: "人", back: "person" },
    ]);
    expect(tanosKanji(readAnkiDeck(path))).toEqual(["上", "人"]);
  });

  it("splits written and reading variants into candidates", () => {
    expect(vocabCandidates({ front: "川/河", back: "かわ" })).toEqual([
      { written: "川", reading: "かわ" },
      { written: "河", reading: "かわ" },
    ]);
    expect(
      vocabCandidates({ front: "毎年", back: "まいねん/まいとし" }).map((c) => c.reading),
    ).toEqual(["まいねん", "まいとし"]);
    expect(vocabCandidates({ front: "暖かい", back: "あたたか(い)" })[0].reading).toBe(
      "あたたかい",
    );
  });

  it("drops the する suffix from a suru noun's reading", () => {
    expect(vocabCandidates({ front: "散歩", back: "さんぽする" })[0].reading).toBe("さんぽ");
    expect(vocabCandidates({ front: "入院", back: "にゅういん・する" })[0].reading).toBe(
      "にゅういん",
    );
    expect(vocabCandidates({ front: "する", back: "する" })[0].reading).toBe("する");
  });
});

describe("fallbackKanjiLevels", () => {
  it("maps old level 4 to N5, old 3 to N4, and fills N3 from old 2 by frequency", () => {
    const k = (literal: string, oldJlpt: number | null, frequency: number | null) => ({
      literal,
      meanings: [],
      readings: [],
      oldJlpt,
      frequency,
    });
    const levels = fallbackKanjiLevels(
      new Map(
        [k("一", 4, 2), k("体", 3, 88), k("畑", 2, 1305), k("鬱", 2, null), k("麗", 1, 1000)].map(
          (x) => [x.literal, x],
        ),
      ),
    );
    expect([...levels]).toEqual([
      ["一", 5],
      ["体", 4],
      ["畑", 3],
      ["鬱", 3],
    ]);
  });
});
