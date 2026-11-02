// 0001 §5.2 selection: which kanji and words make the course.
import type { Meaning, Reading } from "../../src/lib/types";
import { kanjiIn } from "./kana";
import type { JmdictIndex } from "./parse/jmdict";
import { matchVocab } from "./parse/jmdict";
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
