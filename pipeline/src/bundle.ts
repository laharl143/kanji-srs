// npm run pipeline:bundle
// Merges content/subjects.json with content/mnemonics/*.json for the enabled levels into
// content/bundle.json and writes its SHA-256 to content-version.txt (0001 §5.6, spec 0004 AC-4).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import type { Bundle, BundleSubject, ContentSubject } from "../../src/lib/content/types";
import { readSubjects } from "./build";

export const BUNDLE_JSON = "content/bundle.json";
export const VERSION_TXT = "content/content-version.txt";
const ENABLED_LEVELS = "content/enabled-levels.json";
const MNEMONICS_DIR = "content/mnemonics";

export type RadicalMnemonic = { name: string; meaningMnemonic: string };
export type KanjiMnemonic = { meaningMnemonic: string; readingMnemonic: string };
export type VocabMnemonic = { meaningMnemonic?: string; readingMnemonic: string };

// Each file is keyed by characters, which are unique within a type.
export type Mnemonics = {
  radicals: Record<string, RadicalMnemonic>;
  kanji: Record<string, KanjiMnemonic>;
  vocab: Record<string, VocabMnemonic>;
};

export type BundleResult = { ok: true; bundle: Bundle } | { ok: false; errors: string[] };

const filled = (s: string | undefined): s is string => typeof s === "string" && s.trim() !== "";

/**
 * Pure merge plus the two AC-4 checks: every enabled subject has its mnemonics, and every kanji
 * meaning mnemonic names each of its radicals (lowercased substring). A radical's name becomes
 * its only, primary meaning.
 */
export function bundleSubjects(
  subjects: ContentSubject[],
  mnemonics: Mnemonics,
  enabledLevels: number[],
): BundleResult {
  const errors: string[] = [];
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const enabled = new Set(enabledLevels);
  const out: BundleSubject[] = [];

  for (const s of subjects) {
    if (!enabled.has(s.level)) continue;
    const label = `${s.type} ${s.characters} (id ${s.id}, level ${s.level})`;

    if (s.type === "radical") {
      const m = mnemonics.radicals[s.characters];
      if (!filled(m?.name) || !filled(m?.meaningMnemonic)) {
        errors.push(`${label}: missing radical name or meaning mnemonic`);
        continue;
      }
      out.push({
        ...s,
        meanings: [{ text: m.name.trim(), primary: true }],
        readings: [],
        meaningMnemonic: m.meaningMnemonic,
        readingMnemonic: null,
        jlpt: null,
        frequency: null,
      });
    } else if (s.type === "kanji") {
      const m = mnemonics.kanji[s.characters];
      if (!filled(m?.meaningMnemonic) || !filled(m?.readingMnemonic)) {
        errors.push(`${label}: missing meaning or reading mnemonic`);
        continue;
      }
      const story = m.meaningMnemonic.toLowerCase();
      for (const id of s.componentIds) {
        const radical = byId.get(id);
        const name = radical && mnemonics.radicals[radical.characters]?.name;
        if (!filled(name)) {
          errors.push(`${label}: radical ${radical?.characters ?? id} has no name`);
        } else if (!story.includes(name.trim().toLowerCase())) {
          errors.push(`${label}: meaning mnemonic does not name radical "${name}"`);
        }
      }
      out.push({ ...s, meaningMnemonic: m.meaningMnemonic, readingMnemonic: m.readingMnemonic });
    } else {
      const m = mnemonics.vocab[s.characters];
      if (!filled(m?.readingMnemonic)) {
        errors.push(`${label}: missing reading mnemonic`);
        continue;
      }
      out.push({
        ...s,
        meaningMnemonic: m.meaningMnemonic ?? "",
        readingMnemonic: m.readingMnemonic,
      });
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, bundle: { subjects: out } };
}

export function contentVersion(bundleText: string): string {
  return createHash("sha256").update(bundleText).digest("hex");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function main() {
  const subjects = readSubjects();
  if (subjects.length === 0) throw new Error("content/subjects.json is empty: run pipeline:build");
  const mnemonics: Mnemonics = {
    radicals: readJson(`${MNEMONICS_DIR}/radicals.json`),
    kanji: readJson(`${MNEMONICS_DIR}/kanji.json`),
    vocab: readJson(`${MNEMONICS_DIR}/vocab.json`),
  };
  const enabledLevels = readJson<number[]>(ENABLED_LEVELS);
  const result = bundleSubjects(subjects, mnemonics, enabledLevels);
  if (!result.ok) {
    console.error(`Bundle refused, ${result.errors.length} problem(s):`);
    for (const e of result.errors) console.error(`  ${e}`);
    process.exit(1);
  }
  const text = JSON.stringify(result.bundle) + "\n";
  const version = contentVersion(text);
  writeFileSync(BUNDLE_JSON, text);
  writeFileSync(VERSION_TXT, version + "\n");
  console.log(
    `wrote ${BUNDLE_JSON} (${result.bundle.subjects.length} subjects, levels ${enabledLevels.join(", ")})`,
  );
  console.log(`wrote ${VERSION_TXT} (${version})`);
}

if (process.argv[1]?.endsWith("bundle.ts")) main();
