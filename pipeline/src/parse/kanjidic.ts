// KANJIDIC2 as jmdict-simplified JSON (kanjidic2-en).
import type { Meaning, Reading } from "../../../src/lib/types";
import { toHiragana } from "../kana";

export type KanjiInfo = {
  literal: string;
  meanings: Meaning[];
  readings: Reading[];
  frequency: number | null;
  // Pre 2010 JLPT level (4 easiest to 1), for the fallback in 0001 §5.1.
  oldJlpt: number | null;
};

type RawReading = { type: string; value: string };
type RawCharacter = {
  literal: string;
  misc: { frequency: number | null; jlptLevel: number | null };
  readingMeaning: {
    groups: { readings: RawReading[]; meanings: { lang: string; value: string }[] }[];
  } | null;
};
export type KanjidicJson = { characters: RawCharacter[] };

// Content rules (spec 0004): kun'yomi lose their okurigana (from "." on) and "-" markers, all
// readings become hiragana, duplicates go, and every reading of the primary kind (on'yomi when
// the kanji has any, else kun'yomi) is primary.
export function kanjiReadings(onyomi: string[], kunyomi: string[]): Reading[] {
  const out: Reading[] = [];
  const seen = new Set<string>();
  const primaryKind = onyomi.length > 0 ? "onyomi" : "kunyomi";
  const add = (raw: string, kind: "onyomi" | "kunyomi") => {
    const text = toHiragana(raw.split(".")[0].replace(/-/g, "")).trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push({ text, kind, primary: kind === primaryKind });
  };
  for (const r of onyomi) add(r, "onyomi");
  for (const r of kunyomi) add(r, "kunyomi");
  return out;
}

export function parseKanjidic(json: KanjidicJson): Map<string, KanjiInfo> {
  const out = new Map<string, KanjiInfo>();
  for (const c of json.characters) {
    const groups = c.readingMeaning?.groups ?? [];
    const readings = groups.flatMap((g) => g.readings);
    const meanings = [
      ...new Set(
        groups.flatMap((g) => g.meanings.filter((m) => m.lang === "en").map((m) => m.value)),
      ),
    ];
    out.set(c.literal, {
      literal: c.literal,
      meanings: meanings.map((text, i) => ({ text, primary: i === 0 })),
      readings: kanjiReadings(
        readings.filter((r) => r.type === "ja_on").map((r) => r.value),
        readings.filter((r) => r.type === "ja_kun").map((r) => r.value),
      ),
      frequency: c.misc.frequency ?? null,
      oldJlpt: c.misc.jlptLevel ?? null,
    });
  }
  return out;
}
