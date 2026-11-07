// JMdict English as jmdict-simplified JSON (jmdict-eng).
import type { Meaning, Reading } from "../../../src/lib/types";

type RawKanji = { text: string; common: boolean; tags: string[] };
type RawKana = { text: string; common: boolean; tags: string[]; appliesToKanji: string[] };
type RawSense = {
  appliesToKanji: string[];
  appliesToKana: string[];
  gloss: { lang: string; text: string }[];
};
export type JmdictWord = { id: string; kanji: RawKanji[]; kana: RawKana[]; sense: RawSense[] };
export type JmdictJson = { words: JmdictWord[] };

export type JmdictIndex = Map<string, JmdictWord[]>;

// Kana forms that are search only, outdated, irregular, or rare are never offered as readings.
const HIDDEN_KANA_TAGS = new Set(["sK", "sk", "ok", "ik", "rk"]);
const MAX_MEANINGS = 3;

export const applies = (list: string[], value: string) =>
  list.includes("*") || list.includes(value);

// Written form -> entries that list it, common entries first.
export function indexJmdict(json: JmdictJson): JmdictIndex {
  const index: JmdictIndex = new Map();
  for (const word of json.words) {
    for (const k of word.kanji) {
      const list = index.get(k.text) ?? [];
      list.push(word);
      index.set(k.text, list);
    }
  }
  for (const list of index.values()) {
    list.sort((a, b) => Number(isCommon(b)) - Number(isCommon(a)));
  }
  return index;
}

function isCommon(word: JmdictWord): boolean {
  return word.kanji.some((k) => k.common) || word.kana.some((k) => k.common);
}

export type VocabMatch = { jmdictId: string; meanings: Meaning[]; readings: Reading[] };

// 0001 §5.2: match on written form + reading. Keeps up to 3 meanings from the senses that apply
// to both; the matched reading is primary, the entry's other visible readings are not.
export function matchVocab(
  index: JmdictIndex,
  written: string,
  reading: string,
): VocabMatch | undefined {
  for (const word of index.get(written) ?? []) {
    const kana = word.kana.find((k) => k.text === reading && applies(k.appliesToKanji, written));
    if (!kana) continue;
    const glosses = word.sense
      .filter((s) => applies(s.appliesToKanji, written) && applies(s.appliesToKana, reading))
      .flatMap((s) => s.gloss.filter((g) => g.lang === "eng").map((g) => g.text));
    const meanings = [...new Set(glosses)].slice(0, MAX_MEANINGS);
    if (meanings.length === 0) continue;
    const others = word.kana.filter(
      (k) =>
        k.text !== reading &&
        applies(k.appliesToKanji, written) &&
        !k.tags.some((t) => HIDDEN_KANA_TAGS.has(t)),
    );
    return {
      jmdictId: word.id,
      meanings: meanings.map((text, i) => ({ text, primary: i === 0 })),
      readings: [
        { text: reading, primary: true },
        ...others.map((k) => ({ text: k.text, primary: false })),
      ],
    };
  }
  return undefined;
}
