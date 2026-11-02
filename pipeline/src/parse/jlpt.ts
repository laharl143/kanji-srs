// JLPT level lists: Jonathan Waller's tanos decks (Anki 1.x SQLite files), or the KANJIDIC2 old
// JLPT fallback from 0001 §5.1.
import Database from "better-sqlite3";

import type { KanjiInfo } from "./kanjidic";

export type JlptLevel = 5 | 4 | 3;
export type DeckRow = { front: string; back: string };
export type VocabCandidate = { written: string; reading: string };

// An Anki 1.x deck keeps each note's fields in `fields`, named by `fieldModels`.
export function readAnkiDeck(path: string): DeckRow[] {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const rows = db
      .prepare(
        `SELECT f.factId AS id, m.name AS name, f.value AS value
         FROM fields f JOIN fieldModels m ON m.id = f.fieldModelId
         ORDER BY f.factId`,
      )
      .all() as { id: number; name: string; value: string }[];
    const byFact = new Map<number, DeckRow>();
    for (const r of rows) {
      const row = byFact.get(r.id) ?? { front: "", back: "" };
      if (r.name === "Front") row.front = r.value.trim();
      if (r.name === "Back") row.back = r.value.trim();
      byFact.set(r.id, row);
    }
    return [...byFact.values()];
  } finally {
    db.close();
  }
}

export function tanosKanji(rows: DeckRow[]): string[] {
  return rows.map((r) => r.front).filter((f) => [...f].length === 1);
}

// A vocab row can list variants ("川/河", "見る  観る") and readings ("まいげつ/まいつき",
// "あたたか(い)"). Suru verbs list the reading with "する" ("さんぽする", "にゅういん・する")
// while the written form is the noun. Every written x reading pair is a candidate, in order.
export function vocabCandidates(row: DeckRow): VocabCandidate[] {
  const split = (s: string) =>
    s
      .split(/[/／\s]+/)
      .map((p) => p.replace(/[()（）]/g, "").trim())
      .filter(Boolean);
  const written = split(row.front);
  const suru = !/する$/.test(row.front);
  const readings = split(row.back).map((r) => (suru ? r.replace(/・?する$/, "") : r));
  return written.flatMap((w) => readings.map((reading) => ({ written: w, reading })));
}

// 0001 §5.1 fallback: old level 4 -> N5, old 3 -> N4, then old 2 by frequency until ~650 kanji.
export const FALLBACK_TARGET = 650;

export function fallbackKanjiLevels(kanjidic: Map<string, KanjiInfo>): Map<string, JlptLevel> {
  const out = new Map<string, JlptLevel>();
  const all = [...kanjidic.values()];
  for (const k of all) if (k.oldJlpt === 4) out.set(k.literal, 5);
  for (const k of all) if (k.oldJlpt === 3) out.set(k.literal, 4);
  const old2 = all
    .filter((k) => k.oldJlpt === 2)
    .sort((a, b) => (a.frequency ?? Infinity) - (b.frequency ?? Infinity));
  for (const k of old2) {
    if (out.size >= FALLBACK_TARGET) break;
    out.set(k.literal, 3);
  }
  return out;
}
