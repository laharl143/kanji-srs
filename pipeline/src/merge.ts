// npm run pipeline:merge
// Checks every filled batch in pipeline/work/, in number order, and merges it into
// content/mnemonics/*.json, all or nothing per batch (spec 0005 AC-5, AC-6, Merge rules). Never
// edits enabled-levels.json: enabling a level is a separate edit followed by pipeline:bundle.
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";

import {
  fieldText,
  hookOf,
  listBatches,
  MERGED_DIR,
  withBatch,
  WORK_DIR,
  type BatchFile,
} from "./batch";
import {
  loadContent,
  MNEMONIC_FILES,
  readJson,
  SOUND_HOOKS_JSON,
  writeJson,
  type Content,
  type Mnemonics,
  type SoundHooks,
} from "./content";
import { formatLine, validateBatch, type Failure } from "./validate";

export type MergeResult =
  | { status: "skipped" }
  | { status: "refused"; failures: Failure[] }
  | { status: "merged" | "noop"; mnemonics: Mnemonics; soundHooks: SoundHooks };

/** Nothing written yet: every text field is empty and every hook is empty or prefilled. */
export function untouched(batch: BatchFile, content: Content): boolean {
  return batch.items.every((item) => {
    const texts =
      item.type === "radical"
        ? [item.name, item.meaningMnemonic]
        : [item.meaningMnemonic, item.readingMnemonic];
    if (texts.some((t) => fieldText(t) !== "")) return false;
    if (item.type !== "kanji") return true;
    const hook = hookOf(item);
    return (
      hook === "" || hook === fieldText(content.soundHooks[fieldText(item.soundHook?.reading)])
    );
  });
}

/**
 * One batch against the content as the batches before it left it. Pure: the caller writes the
 * files. A refused batch changes nothing; merging an already merged batch again is a no op.
 */
export function mergeBatch(batch: BatchFile, content: Content): MergeResult {
  if (untouched(batch, content)) return { status: "skipped" };
  const failures = validateBatch(batch, content);
  if (failures.length > 0) return { status: "refused", failures };
  const { mnemonics, soundHooks } = withBatch(content, batch);
  const same =
    JSON.stringify([mnemonics, soundHooks]) ===
    JSON.stringify([content.mnemonics, content.soundHooks]);
  return { status: same ? "noop" : "merged", mnemonics, soundHooks };
}

function writeChanged(before: Content, mnemonics: Mnemonics, soundHooks: SoundHooks) {
  for (const key of ["radicals", "kanji", "vocab"] as const) {
    if (JSON.stringify(before.mnemonics[key]) !== JSON.stringify(mnemonics[key])) {
      writeJson(MNEMONIC_FILES[key], mnemonics[key]);
    }
  }
  if (JSON.stringify(before.soundHooks) !== JSON.stringify(soundHooks)) {
    writeJson(SOUND_HOOKS_JSON, soundHooks);
  }
}

function main() {
  let content = loadContent();
  const batches = listBatches(WORK_DIR);
  if (batches.length === 0) console.log(`nothing to merge in ${WORK_DIR}`);
  let refused = 0;
  for (const { file } of batches) {
    const path = join(WORK_DIR, file);
    let batch: BatchFile;
    try {
      batch = readJson<BatchFile>(path);
      if (!Array.isArray(batch.items)) throw new Error("it has no items list");
    } catch (error) {
      refused++;
      console.log(`${file}: refused, nothing merged: cannot read it (${(error as Error).message})`);
      continue;
    }

    const result = mergeBatch(batch, content);
    if (result.status === "skipped") {
      console.log(`${file}: skipped, not filled yet`);
      continue;
    }
    if (result.status === "refused") {
      refused++;
      console.log(`${file}: refused, nothing merged, ${result.failures.length} failure(s):`);
      for (const f of result.failures) console.log(`  ${formatLine(f)}`);
      continue;
    }
    if (result.status === "merged") {
      writeChanged(content, result.mnemonics, result.soundHooks);
      content = { ...content, mnemonics: result.mnemonics, soundHooks: result.soundHooks };
    }
    mkdirSync(MERGED_DIR, { recursive: true });
    renameSync(path, join(MERGED_DIR, file));
    const what =
      result.status === "noop"
        ? "no op (already merged)"
        : `merged ${batch.items.length} ${batch.items[0]?.type ?? ""} items`;
    console.log(`${file}: ${what}, moved to ${MERGED_DIR}/`);
  }
  if (refused > 0) {
    console.log(`\n${refused} batch(es) refused: fix them in place and run merge again`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("merge.ts")) main();
