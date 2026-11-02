// npm run pipeline:build
// Reads pipeline/raw, writes content/subjects.json, and prints the build report (spec 0004 AC-3).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ContentSubject } from "../../src/lib/content/types";
import { loadCodepoints, missingGlyphs, NOTO_SANS_JP } from "./glyphs";
import { buildLevels } from "./levels";
import { indexJmdict, type JmdictJson } from "./parse/jmdict";
import {
  fallbackKanjiLevels,
  readAnkiDeck,
  tanosKanji,
  type DeckRow,
  type JlptLevel,
} from "./parse/jlpt";
import { parseKanjidic, type KanjidicJson } from "./parse/kanjidic";
import { parseKradfile, type KradfileJson } from "./parse/kradfile";
import { select, type Selection } from "./select";
import { RAW, RAW_DIR, tanosLicense } from "./sources";

export const SUBJECTS_JSON = "content/subjects.json";
const LEVELS: JlptLevel[] = [5, 4, 3];

function readJson<T>(file: string): T {
  const path = join(RAW_DIR, file);
  if (!existsSync(path)) throw new Error(`${path} is missing: run npm run pipeline:download`);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function readSubjects(path = SUBJECTS_JSON): ContentSubject[] {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as ContentSubject[]) : [];
}

export type BuildReportInput = {
  subjects: ContentSubject[];
  selection: Selection;
  usedFallback: boolean;
  noGlyph: string[];
};

export function formatReport({ subjects, selection, usedFallback, noGlyph }: BuildReportInput) {
  const lines: string[] = [];
  if (usedFallback) {
    lines.push(
      `JLPT source: KANJIDIC2 old JLPT fallback (tanos license is "${tanosLicense}"). ` +
        "Vocab lists come only from tanos, so no vocab was selected.",
    );
  } else {
    lines.push("JLPT source: tanos N5 to N3 lists (license confirmed usable).");
  }
  const levels = [...new Set(subjects.map((s) => s.level))].sort((a, b) => a - b);
  lines.push("", "Level  radicals  kanji  vocab");
  for (const level of levels) {
    const n = (type: string) => subjects.filter((s) => s.level === level && s.type === type).length;
    lines.push(
      `${String(level).padStart(5)}  ${String(n("radical")).padStart(8)}  ${String(n("kanji")).padStart(5)}  ${String(n("vocab")).padStart(5)}`,
    );
  }
  const total = (type: string) => subjects.filter((s) => s.type === type).length;
  lines.push(
    `Total  ${String(total("radical")).padStart(8)}  ${String(total("kanji")).padStart(5)}  ${String(total("vocab")).padStart(5)}`,
  );

  const reasons = [...new Set(selection.dropped.map((d) => d.reason))];
  lines.push("", `Dropped vocab: ${selection.dropped.length}`);
  for (const reason of reasons) {
    const items = selection.dropped.filter((d) => d.reason === reason);
    lines.push(
      `  ${reason} (${items.length}): ${items.map((d) => `${d.front}【${d.back}】N${d.jlpt}`).join(", ")}`,
    );
  }
  if (selection.missingKanji.length > 0) {
    lines.push(`Kanji not in KANJIDIC2 (dropped): ${selection.missingKanji.join(" ")}`);
  }
  if (selection.noComponents.length > 0) {
    lines.push(`Kanji with no KRADFILE components: ${selection.noComponents.join(" ")}`);
  }
  lines.push(
    `Components with no Noto Sans JP glyph (kept; substitutes come in 0005): ${noGlyph.length ? noGlyph.join(" ") : "none"}`,
  );
  return lines.join("\n");
}

function main() {
  const kanjidic = parseKanjidic(readJson<KanjidicJson>(RAW.kanjidic));
  const kradfile = parseKradfile(readJson<KradfileJson>(RAW.kradfile));
  const jmdict = indexJmdict(readJson<JmdictJson>(RAW.jmdict));

  const usedFallback = tanosLicense !== "usable";
  let kanjiLevels: Map<string, JlptLevel>;
  const vocabRows: { row: DeckRow; jlpt: JlptLevel }[] = [];
  if (usedFallback) {
    kanjiLevels = fallbackKanjiLevels(kanjidic);
  } else {
    kanjiLevels = new Map();
    for (const n of LEVELS) {
      for (const k of tanosKanji(readAnkiDeck(join(RAW_DIR, RAW.tanosKanji(n))))) {
        if (!kanjiLevels.has(k)) kanjiLevels.set(k, n);
      }
      for (const row of readAnkiDeck(join(RAW_DIR, RAW.tanosVocab(n)))) {
        vocabRows.push({ row, jlpt: n });
      }
    }
  }

  const selection = select({ kanjiLevels, vocabRows, kanjidic, kradfile, jmdict });
  const subjects = buildLevels(selection, readSubjects());
  writeFileSync(SUBJECTS_JSON, JSON.stringify(subjects, null, 1) + "\n");

  const radicals = subjects.filter((s) => s.type === "radical").map((s) => s.characters);
  const noGlyph = missingGlyphs(radicals, loadCodepoints(NOTO_SANS_JP));
  console.log(formatReport({ subjects, selection, usedFallback, noGlyph }));
  console.log(`\nwrote ${SUBJECTS_JSON} (${subjects.length} subjects)`);
}

if (process.argv[1]?.endsWith("build.ts")) main();
