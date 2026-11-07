// npm run pipeline:build
// Reads pipeline/raw, writes content/subjects.json and content/retired.json, and prints the build
// report (spec 0004 AC-3, spec 0005 AC-4).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ContentSubject } from "../../src/lib/content/types";
import {
  readRetired,
  readSubjects,
  RETIRED_JSON,
  subjectKey,
  SUBJECTS_JSON,
  writeJson,
  type IdEntry,
} from "./content";
import { loadCodepoints, missingGlyphs, NOTO_SANS_JP } from "./glyphs";
import { buildLevels, retiredChanges } from "./levels";
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
import { RAW, RAW_DIR, tanosLicense, type TanosLicense } from "./sources";

const LEVELS: JlptLevel[] = [5, 4, 3];

function readJson<T>(file: string): T {
  const path = join(RAW_DIR, file);
  if (!existsSync(path)) throw new Error(`${path} is missing: run npm run pipeline:download`);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export type BuildReportInput = {
  subjects: ContentSubject[];
  selection: Selection;
  // The tanos license decision; anything but "usable" means the fallbacks ran.
  license: TanosLicense;
  noGlyph: string[];
  // What this build changed in retired.json (spec 0005 AC-9).
  ids?: { retired: IdEntry[]; restored: IdEntry[] };
};

const idList = (entries: IdEntry[]) =>
  entries.length ? entries.map((e) => `${subjectKey(e)} (id ${e.id})`).join(", ") : "none";

export function formatReport({
  subjects,
  selection,
  license,
  noGlyph,
  ids = { retired: [], restored: [] },
}: BuildReportInput) {
  const lines: string[] = [];
  const words = selection.vocab.length;
  if (license !== "usable") {
    lines.push(
      `JLPT source: KANJIDIC2 old JLPT fallback (tanos license is "${license}").`,
      `Vocab source: JMdict common words fallback (tanos license is "${license}"): ${words} words`,
    );
  } else {
    lines.push(
      "JLPT source: tanos N5 to N3 lists (license confirmed usable).",
      `Vocab source: tanos N5 to N3 vocab lists: ${words} words`,
    );
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
    `Components with no Noto Sans JP glyph (kept; review by hand): ${noGlyph.length ? noGlyph.join(" ") : "none"}`,
  );
  lines.push(
    `Retired by this build (${ids.retired.length}): ${idList(ids.retired)}`,
    `Restored by this build (${ids.restored.length}): ${idList(ids.restored)}`,
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

  const selection = select({
    kanjiLevels,
    vocabRows,
    kanjidic,
    kradfile,
    jmdict,
    vocabFallback: usedFallback,
  });
  const retiredBefore = readRetired();
  const { subjects, retired } = buildLevels(selection, readSubjects(), retiredBefore);
  writeFileSync(SUBJECTS_JSON, JSON.stringify(subjects, null, 1) + "\n");
  writeJson(RETIRED_JSON, retired);

  const radicals = subjects.filter((s) => s.type === "radical").map((s) => s.characters);
  const noGlyph = missingGlyphs(radicals, loadCodepoints(NOTO_SANS_JP));
  const ids = retiredChanges(retiredBefore, retired);
  console.log(formatReport({ subjects, selection, license: tanosLicense, noGlyph, ids }));
  console.log(`\nwrote ${SUBJECTS_JSON} (${subjects.length} subjects)`);
  console.log(`wrote ${RETIRED_JSON} (${retired.length} retired)`);
}

if (process.argv[1]?.endsWith("build.ts")) main();
