// The content files every pipeline step reads (spec 0005): one set of types and one loader, so
// validate, batch, merge, and bundle always see the same content.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Bundle, ContentSubject } from "../../src/lib/content/types";
import type { SubjectType } from "../../src/lib/types";

export const SUBJECTS_JSON = "content/subjects.json";
export const RETIRED_JSON = "content/retired.json";
export const BUNDLE_JSON = "content/bundle.json";
export const VERSION_TXT = "content/content-version.txt";
export const ENABLED_LEVELS_JSON = "content/enabled-levels.json";
export const MNEMONICS_DIR = "content/mnemonics";
export const MNEMONIC_FILES = {
  radicals: `${MNEMONICS_DIR}/radicals.json`,
  kanji: `${MNEMONICS_DIR}/kanji.json`,
  vocab: `${MNEMONICS_DIR}/vocab.json`,
} as const;
export const SOUND_HOOKS_JSON = `${MNEMONICS_DIR}/sound-hooks.json`;

export type RadicalMnemonic = { name: string; meaningMnemonic: string };
export type KanjiMnemonic = { meaningMnemonic: string; readingMnemonic: string };
export type VocabMnemonic = { meaningMnemonic?: string; readingMnemonic: string };

// Each file is keyed by characters, which are unique within a type.
export type Mnemonics = {
  radicals: Record<string, RadicalMnemonic>;
  kanji: Record<string, KanjiMnemonic>;
  vocab: Record<string, VocabMnemonic>;
};

// Hiragana reading -> its one English hook word.
export type SoundHooks = Record<string, string>;

export type IdEntry = { id: number; type: SubjectType; characters: string };

export type Content = {
  subjects: ContentSubject[];
  mnemonics: Mnemonics;
  soundHooks: SoundHooks;
  enabledLevels: number[];
  // The subjects in the committed content/bundle.json, the last content that reached the phone.
  shipped: IdEntry[];
  // Ids that left the course (content/retired.json), never given to another item.
  retired: IdEntry[];
};

// The file that holds a subject type's mnemonics.
export const MNEMONIC_KEY = { radical: "radicals", kanji: "kanji", vocab: "vocab" } as const;

// Subjects are unique by type and characters, so this key names one subject across builds.
export const subjectKey = (s: { type: SubjectType; characters: string }) =>
  `${s.type}:${s.characters}`;

export const idEntry = ({ id, type, characters }: IdEntry): IdEntry => ({ id, type, characters });

export const filled = (s: unknown): s is string => typeof s === "string" && s.trim() !== "";

export const firstPrimaryReading = (s: ContentSubject): string | undefined =>
  s.readings.find((r) => r.primary)?.text;

/** The mnemonic fields a subject still lacks: radical name and story, kanji both, vocab reading. */
export function missingMnemonic(s: ContentSubject, mnemonics: Mnemonics): string[] {
  const missing = (fields: [string, unknown][]) =>
    fields.filter(([, value]) => !filled(value)).map(([field]) => field);
  if (s.type === "radical") {
    const m = mnemonics.radicals[s.characters];
    return missing([
      ["name", m?.name],
      ["meaningMnemonic", m?.meaningMnemonic],
    ]);
  }
  if (s.type === "kanji") {
    const m = mnemonics.kanji[s.characters];
    return missing([
      ["meaningMnemonic", m?.meaningMnemonic],
      ["readingMnemonic", m?.readingMnemonic],
    ]);
  }
  return missing([["readingMnemonic", mnemonics.vocab[s.characters]?.readingMnemonic]]);
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readJsonOr<T>(path: string, fallback: T): T {
  return existsSync(path) ? readJson<T>(path) : fallback;
}

// Two space JSON plus a newline, the format of the hand written content files.
export function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

export function readSubjects(path = SUBJECTS_JSON): ContentSubject[] {
  return readJsonOr<ContentSubject[]>(path, []);
}

export function readRetired(path = RETIRED_JSON): IdEntry[] {
  return readJsonOr<IdEntry[]>(path, []);
}

/** Reads every content file under `root`. Only subjects.json is required. */
export function loadContent(root = "."): Content {
  const at = (path: string) => join(root, path);
  if (!existsSync(at(SUBJECTS_JSON))) {
    throw new Error(`${SUBJECTS_JSON} is missing: run npm run pipeline:build`);
  }
  const bundle = readJsonOr<Bundle>(at(BUNDLE_JSON), { subjects: [] });
  return {
    subjects: readSubjects(at(SUBJECTS_JSON)),
    mnemonics: {
      radicals: readJsonOr(at(MNEMONIC_FILES.radicals), {}),
      kanji: readJsonOr(at(MNEMONIC_FILES.kanji), {}),
      vocab: readJsonOr(at(MNEMONIC_FILES.vocab), {}),
    },
    soundHooks: readJsonOr(at(SOUND_HOOKS_JSON), {}),
    enabledLevels: readJsonOr(at(ENABLED_LEVELS_JSON), []),
    shipped: bundle.subjects.map(idEntry),
    retired: readRetired(at(RETIRED_JSON)),
  };
}
