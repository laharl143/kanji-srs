// npm run pipeline:batch -- --levels 2-3
// Writes pipeline/work/batch-NNN.json files for Claude Code to fill: at most 25 items of one type
// with no mnemonic yet, radicals before kanji before vocab, each with the data its writing needs
// (spec 0005 AC-5, Batch item shape, Batch rules).
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { ContentSubject } from "../../src/lib/content/types";
import type { Reading, SubjectType } from "../../src/lib/types";
import {
  filled,
  firstPrimaryReading,
  loadContent,
  missingMnemonic,
  MNEMONIC_KEY,
  readJson,
  subjectKey,
  writeJson,
  type Content,
  type Mnemonics,
  type SoundHooks,
} from "./content";

export const WORK_DIR = "pipeline/work";
export const MERGED_DIR = "pipeline/work/merged";
export const BATCH_SIZE = 25;
export const USED_BY_SHOWN = 5;

type ItemBase = { id: number; characters: string; level: number };

// Field names match the mnemonics files, so merge copies the writable fields across.
export type RadicalItem = { type: "radical" } & ItemBase & {
    usedBy: { characters: string; meaning: string }[];
    usedByCount: number;
    name: string;
    meaningMnemonic: string;
  };

export type KanjiItem = { type: "kanji" } & ItemBase & {
    meanings: string[];
    readings: Reading[];
    radicals: { characters: string; name: string }[];
    // Prefilled when sound-hooks.json already has the reading; never change a prefilled hook.
    soundHook: { reading: string; hook: string };
    meaningMnemonic: string;
    readingMnemonic: string;
  };

export type VocabItem = { type: "vocab" } & ItemBase & {
    meanings: string[];
    readings: string[];
    // Each kanji's hook for its primary reading (null when it has none), to reuse in the story.
    kanji: { characters: string; meaning: string; readings: string[]; hook: string | null }[];
    // Optional (0001 §5.4).
    meaningMnemonic: string;
    readingMnemonic: string;
  };

export type BatchItem = RadicalItem | KanjiItem | VocabItem;

export type BatchFile = { batch: number; createdAt: string; levels: number[]; items: BatchItem[] };

const TYPE_ORDER: SubjectType[] = ["radical", "kanji", "vocab"];

const texts = (list: { text: string; primary: boolean }[]) =>
  [...list].sort((a, b) => Number(b.primary) - Number(a.primary)).map((x) => x.text);

const primaryMeaning = (s: ContentSubject) =>
  (s.meanings.find((m) => m.primary) ?? s.meanings[0])?.text ?? "";

function toItem(s: ContentSubject, content: Content, byId: Map<number, ContentSubject>): BatchItem {
  const base = { id: s.id, characters: s.characters, level: s.level };
  const parts = s.componentIds.flatMap((id) => byId.get(id) ?? []);
  if (s.type === "radical") {
    const users = content.subjects
      .filter((k) => k.type === "kanji" && k.componentIds.includes(s.id))
      .sort((a, b) => a.level - b.level || a.position - b.position);
    return {
      type: "radical",
      ...base,
      usedBy: users
        .slice(0, USED_BY_SHOWN)
        .map((k) => ({ characters: k.characters, meaning: primaryMeaning(k) })),
      usedByCount: users.length,
      name: "",
      meaningMnemonic: "",
    };
  }
  if (s.type === "kanji") {
    const reading = firstPrimaryReading(s) ?? "";
    return {
      type: "kanji",
      ...base,
      meanings: texts(s.meanings),
      readings: s.readings,
      radicals: parts.map((r) => ({
        characters: r.characters,
        name: content.mnemonics.radicals[r.characters]?.name ?? "",
      })),
      soundHook: { reading, hook: content.soundHooks[reading] ?? "" },
      meaningMnemonic: "",
      readingMnemonic: "",
    };
  }
  return {
    type: "vocab",
    ...base,
    meanings: texts(s.meanings),
    readings: texts(s.readings),
    kanji: parts.map((k) => {
      const reading = firstPrimaryReading(k);
      return {
        characters: k.characters,
        meaning: primaryMeaning(k),
        readings: k.readings.map((r) => r.text),
        hook: (reading !== undefined && content.soundHooks[reading]) || null,
      };
    }),
    meaningMnemonic: "",
    readingMnemonic: "",
  };
}

export type LeftOut = { subject: string; level: number; waitingFor: string[] };
export type Plan = { files: BatchFile[]; leftOut: LeftOut[] };

/**
 * Plans the next batches for `levels`: subjects with no entry in their mnemonics file and not in
 * an unmerged batch (`pending`, by type and characters). A kanji waits until its radicals have
 * names and a vocab until its kanji have mnemonics, so a level takes three rounds.
 */
export function planBatches(
  content: Content,
  levels: number[],
  pending: Set<string>,
  { firstNumber, createdAt }: { firstNumber: number; createdAt: string },
): Plan {
  const byId = new Map(content.subjects.map((s) => [s.id, s]));
  const wanted = new Set(levels);
  const leftOut: LeftOut[] = [];
  const ready = content.subjects.filter((s) => {
    if (!wanted.has(s.level) || pending.has(subjectKey(s))) return false;
    if (Object.hasOwn(content.mnemonics[MNEMONIC_KEY[s.type]], s.characters)) return false;
    if (s.type === "radical") return true;
    const parts = s.componentIds.flatMap((id) => byId.get(id) ?? []);
    const waiting =
      s.type === "kanji"
        ? parts.filter((r) => !filled(content.mnemonics.radicals[r.characters]?.name))
        : parts.filter((k) => missingMnemonic(k, content.mnemonics).length > 0);
    if (waiting.length === 0) return true;
    leftOut.push({ subject: subjectKey(s), level: s.level, waitingFor: waiting.map(subjectKey) });
    return false;
  });

  const files: BatchFile[] = [];
  for (const type of TYPE_ORDER) {
    const ofType = ready
      .filter((s) => s.type === type)
      .sort((a, b) => a.level - b.level || a.position - b.position);
    for (let i = 0; i < ofType.length; i += BATCH_SIZE) {
      files.push({
        batch: firstNumber + files.length,
        createdAt,
        levels,
        items: ofType.slice(i, i + BATCH_SIZE).map((s) => toItem(s, content, byId)),
      });
    }
  }
  return { files, leftOut };
}

// A batch field as merge reads it: trimmed, and "" for anything that is not a string.
export const fieldText = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const text = fieldText;

/** The entry an item writes into its mnemonics file (trimmed; an empty vocab meaning is left out). */
export function entryOf(item: BatchItem) {
  if (item.type === "radical") {
    return { name: text(item.name), meaningMnemonic: text(item.meaningMnemonic) };
  }
  if (item.type === "kanji") {
    return {
      meaningMnemonic: text(item.meaningMnemonic),
      readingMnemonic: text(item.readingMnemonic),
    };
  }
  const meaning = text(item.meaningMnemonic);
  return meaning
    ? { meaningMnemonic: meaning, readingMnemonic: text(item.readingMnemonic) }
    : { readingMnemonic: text(item.readingMnemonic) };
}

/** A kanji item's hook, trimmed ("" when unfilled). */
export const hookOf = (item: KanjiItem) => text(item.soundHook?.hook);

/**
 * The content as it would be with this batch merged: new entries go at the end of each file in
 * batch order, existing keys are never touched, and a kanji's hook is added for a reading
 * sound-hooks.json does not have yet.
 */
export function withBatch(content: Content, batch: BatchFile): Content {
  const mnemonics: Mnemonics = {
    radicals: { ...content.mnemonics.radicals },
    kanji: { ...content.mnemonics.kanji },
    vocab: { ...content.mnemonics.vocab },
  };
  const soundHooks: SoundHooks = { ...content.soundHooks };
  for (const item of batch.items) {
    const file = mnemonics[MNEMONIC_KEY[item.type]] as Record<string, unknown> | undefined;
    if (!file) continue; // an unknown type: batch-identity refuses the batch
    if (!Object.hasOwn(file, item.characters)) file[item.characters] = entryOf(item);
    if (item.type === "kanji") {
      const reading = text(item.soundHook?.reading);
      const hook = hookOf(item);
      if (reading && hook && !Object.hasOwn(soundHooks, reading)) soundHooks[reading] = hook;
    }
  }
  return { ...content, mnemonics, soundHooks };
}

export const batchName = (n: number) => `batch-${String(n).padStart(3, "0")}.json`;

/** Batch files in a folder, in number order. */
export function listBatches(dir: string): { file: string; number: number }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .flatMap((file) => {
      const m = /^batch-(\d+)\.json$/.exec(file);
      return m ? [{ file, number: Number(m[1]) }] : [];
    })
    .sort((a, b) => a.number - b.number);
}

/** `N` or `A-B`, every level between 1 and the highest level; null for anything else. */
export function parseLevels(arg: string | undefined, maxLevel: number): number[] | null {
  const m = /^(\d+)(?:-(\d+))?$/.exec(arg ?? "");
  if (!m) return null;
  const from = Number(m[1]);
  const to = m[2] === undefined ? from : Number(m[2]);
  if (from < 1 || from > to || to > maxLevel) return null;
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function levelsArg(argv: string[]): string | undefined {
  const at = argv.indexOf("--levels");
  if (at >= 0) return argv[at + 1];
  return argv.find((a) => a.startsWith("--levels="))?.slice("--levels=".length);
}

function main() {
  const content = loadContent();
  const maxLevel = content.subjects.reduce((max, s) => Math.max(max, s.level), 0);
  const arg = levelsArg(process.argv.slice(2));
  const levels = parseLevels(arg, maxLevel);
  if (!levels) {
    console.error(
      `--levels must be N or A-B with levels from 1 to ${maxLevel}, got "${arg ?? ""}"`,
    );
    console.error("usage: npm run pipeline:batch -- --levels 2-3");
    process.exit(1);
  }

  const pending = new Set<string>();
  for (const { file } of listBatches(WORK_DIR)) {
    const path = join(WORK_DIR, file);
    let batch: BatchFile;
    try {
      batch = readJson<BatchFile>(path);
    } catch (error) {
      console.error(
        `${path} is not valid JSON (${(error as Error).message}): fix or delete it, then run batch again`,
      );
      process.exit(1);
    }
    for (const item of batch.items) pending.add(subjectKey(item));
  }
  const highest = [...listBatches(WORK_DIR), ...listBatches(MERGED_DIR)].reduce(
    (max, b) => Math.max(max, b.number),
    0,
  );

  const { files, leftOut } = planBatches(content, levels, pending, {
    firstNumber: highest + 1,
    createdAt: new Date().toISOString(),
  });
  const span = levels.length === 1 ? `level ${levels[0]}` : `levels ${levels[0]}-${levels.at(-1)}`;
  if (files.length === 0) console.log(`nothing to write for ${span}`);
  mkdirSync(WORK_DIR, { recursive: true });
  for (const f of files) {
    const path = join(WORK_DIR, batchName(f.batch));
    writeJson(path, f);
    const itemLevels = [...new Set(f.items.map((i) => i.level))].join(", ");
    console.log(`wrote ${path}: ${f.items.length} ${f.items[0].type} items (level ${itemLevels})`);
  }
  if (pending.size > 0) console.log(`${pending.size} items are already in unmerged batches`);
  if (leftOut.length > 0) {
    console.log(
      `\n${leftOut.length} left out until their parts are written (merge the earlier batches, then run batch again):`,
    );
    for (const l of leftOut)
      console.log(`  ${l.subject} (level ${l.level}): waiting for ${l.waitingFor.join(", ")}`);
  }
}

if (process.argv[1]?.endsWith("batch.ts")) main();
