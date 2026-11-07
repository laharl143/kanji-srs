// 0001 §5.2 selection: which kanji and words make the course.
import type { Meaning, Reading } from "../../src/lib/types";
import { kanjiIn } from "./kana";
import { orderKanji } from "./levels";
import type { JmdictIndex } from "./parse/jmdict";
import { applies, matchVocab } from "./parse/jmdict";
import type { DeckRow, JlptLevel } from "./parse/jlpt";
import { vocabCandidates } from "./parse/jlpt";
import type { KanjiInfo } from "./parse/kanjidic";

export type SelectedKanji = KanjiInfo & { jlpt: JlptLevel; components: string[] };

export type SelectedVocab = {
  characters: string;
  jlpt: JlptLevel;
  meanings: Meaning[];
  readings: Reading[];
  // The word's kanji, in order of appearance, no repeats.
  kanji: string[];
};

export type DropReason = "no kanji" | "kanji outside the set" | "no JMdict match" | "duplicate";
export type Dropped = { front: string; back: string; jlpt: JlptLevel; reason: DropReason };

export type SelectInput = {
  // Every course kanji with its JLPT level (tanos lists, or the KANJIDIC2 fallback).
  kanjiLevels: Map<string, JlptLevel>;
  // Vocab rows in list order, N5 first.
  vocabRows: { row: DeckRow; jlpt: JlptLevel }[];
  kanjidic: Map<string, KanjiInfo>;
  kradfile: Map<string, string[]>;
  jmdict: JmdictIndex;
  // True when the tanos license is not usable: vocab come from JMdict common words instead of
  // vocabRows (spec 0005 Vocab fallback).
  vocabFallback?: boolean;
};

export type Selection = {
  kanji: SelectedKanji[];
  vocab: SelectedVocab[];
  dropped: Dropped[];
  // Course kanji that KANJIDIC2 does not know (dropped), and kanji with no KRADFILE entry.
  missingKanji: string[];
  noComponents: string[];
};

export function select(input: SelectInput): Selection {
  const kanji: SelectedKanji[] = [];
  const missingKanji: string[] = [];
  const noComponents: string[] = [];
  for (const [char, jlpt] of input.kanjiLevels) {
    const info = input.kanjidic.get(char);
    if (!info) {
      missingKanji.push(char);
      continue;
    }
    const components = input.kradfile.get(char) ?? [];
    if (components.length === 0) noComponents.push(char);
    kanji.push({ ...info, jlpt, components });
  }
  if (input.vocabFallback) {
    return {
      kanji,
      vocab: commonWords(kanji, input.jmdict),
      dropped: [],
      missingKanji,
      noComponents,
    };
  }
  const kanjiSet = new Set(kanji.map((k) => k.literal));

  const vocab: SelectedVocab[] = [];
  const dropped: Dropped[] = [];
  const seen = new Set<string>();
  for (const { row, jlpt } of input.vocabRows) {
    const result = pickVocab(row, kanjiSet, input.jmdict);
    if ("reason" in result) {
      dropped.push({ front: row.front, back: row.back, jlpt, reason: result.reason });
      continue;
    }
    // The same word in two lists (or two readings of one written form) keeps its first, easiest
    // level: subjects are unique by type and characters.
    if (seen.has(result.characters)) {
      dropped.push({ front: row.front, back: row.back, jlpt, reason: "duplicate" });
      continue;
    }
    seen.add(result.characters);
    vocab.push({ ...result, jlpt });
  }
  return { kanji, vocab, dropped, missingKanji, noComponents };
}

function pickVocab(
  row: DeckRow,
  kanjiSet: Set<string>,
  jmdict: JmdictIndex,
): Omit<SelectedVocab, "jlpt"> | { reason: DropReason } {
  const candidates = vocabCandidates(row).filter((c) => kanjiIn(c.written).length > 0);
  if (candidates.length === 0) return { reason: "no kanji" };
  const inSet = candidates.filter((c) => kanjiIn(c.written).every((k) => kanjiSet.has(k)));
  if (inSet.length === 0) return { reason: "kanji outside the set" };
  for (const c of inSet) {
    const match = matchVocab(jmdict, c.written, c.reading);
    if (match) {
      return {
        characters: c.written,
        meanings: match.meanings,
        readings: match.readings,
        kanji: [...new Set(kanjiIn(c.written))],
      };
    }
  }
  return { reason: "no JMdict match" };
}

export const COMMON_WORDS_PER_KANJI = 3;

/**
 * The vocab fallback (spec 0005): one candidate per JMdict written form that is marked common,
 * has at least one kanji, and uses only course kanji. Its entry is the first one listed (common
 * entries come first) and its reading that entry's first common kana form for the written form.
 * Each kanji, in course order, takes up to 3 candidates whose latest kanji it is: shortest
 * written form first, then the lowest JMdict id. JLPT level is the hardest of its kanji.
 */
export function commonWords(kanji: SelectedKanji[], jmdict: JmdictIndex): SelectedVocab[] {
  const order = orderKanji(kanji);
  const rank = new Map(order.map((k, i) => [k.literal, i]));
  const jlpt = new Map(kanji.map((k) => [k.literal, k.jlpt]));
  type Candidate = { vocab: SelectedVocab; id: number; length: number };
  const byLatest = new Map<string, Candidate[]>();

  for (const [written, entries] of jmdict) {
    const chars = [...new Set(kanjiIn(written))];
    if (chars.length === 0 || !chars.every((c) => rank.has(c))) continue;
    const entry = entries[0];
    if (!entry.kanji.some((k) => k.text === written && k.common)) continue;
    const kana = entry.kana.find((k) => k.common && applies(k.appliesToKanji, written));
    const match = kana && matchVocab(jmdict, written, kana.text);
    if (!match) continue;
    const latest = chars.reduce((a, b) => (rank.get(b)! > rank.get(a)! ? b : a));
    const vocab: SelectedVocab = {
      characters: written,
      jlpt: Math.min(...chars.map((c) => jlpt.get(c)!)) as JlptLevel,
      meanings: match.meanings,
      readings: match.readings,
      kanji: chars,
    };
    const list = byLatest.get(latest) ?? [];
    list.push({ vocab, id: Number(entry.id), length: [...written].length });
    byLatest.set(latest, list);
  }

  return order.flatMap((k) =>
    (byLatest.get(k.literal) ?? [])
      .sort((a, b) => a.length - b.length || a.id - b.id)
      .slice(0, COMMON_WORDS_PER_KANJI)
      .map((c) => c.vocab),
  );
}
