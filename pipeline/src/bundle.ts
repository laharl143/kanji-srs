// npm run pipeline:bundle
// Merges content/subjects.json with content/mnemonics/*.json for the enabled levels into
// content/bundle.json and writes its SHA-256 to content-version.txt (0001 §5.6, spec 0004 AC-4).
// Refuses to write when validation fails (spec 0005 AC-8).
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

import type { Bundle, BundleSubject, ContentSubject } from "../../src/lib/content/types";
import { BUNDLE_JSON, loadContent, VERSION_TXT, type Content, type Mnemonics } from "./content";
import { formatLine, validateAll, type Failure } from "./validate";

export type BundleResult = { ok: true; bundle: Bundle } | { ok: false; failures: Failure[] };

/**
 * Pure merge of the enabled levels with their mnemonics. A radical's name becomes its only,
 * primary meaning. Run it on validated content: a missing mnemonic throws.
 */
export function bundleSubjects(
  subjects: ContentSubject[],
  mnemonics: Mnemonics,
  enabledLevels: number[],
): Bundle {
  const enabled = new Set(enabledLevels);
  const missing = (s: ContentSubject): never => {
    throw new Error(`${s.type}:${s.characters} has no mnemonic: validate the content first`);
  };
  const out: BundleSubject[] = [];
  for (const s of subjects) {
    if (!enabled.has(s.level)) continue;
    if (s.type === "radical") {
      const m = mnemonics.radicals[s.characters] ?? missing(s);
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
      const m = mnemonics.kanji[s.characters] ?? missing(s);
      out.push({ ...s, meaningMnemonic: m.meaningMnemonic, readingMnemonic: m.readingMnemonic });
    } else {
      const m = mnemonics.vocab[s.characters] ?? missing(s);
      out.push({
        ...s,
        meaningMnemonic: m.meaningMnemonic ?? "",
        readingMnemonic: m.readingMnemonic,
      });
    }
  }
  return { subjects: out };
}

/** Validates every rule first, then merges. Any failure refuses the whole bundle. */
export function buildBundle(content: Content): BundleResult {
  const { failures } = validateAll(content);
  if (failures.length > 0) return { ok: false, failures };
  return {
    ok: true,
    bundle: bundleSubjects(content.subjects, content.mnemonics, content.enabledLevels),
  };
}

export function contentVersion(bundleText: string): string {
  return createHash("sha256").update(bundleText).digest("hex");
}

function main() {
  const content = loadContent();
  if (content.subjects.length === 0)
    throw new Error("content/subjects.json is empty: run pipeline:build");
  const result = buildBundle(content);
  if (!result.ok) {
    console.error(`Bundle refused, ${result.failures.length} validation failure(s):`);
    for (const f of result.failures) console.error(`  ${formatLine(f)}`);
    process.exit(1);
  }
  const text = JSON.stringify(result.bundle) + "\n";
  const version = contentVersion(text);
  writeFileSync(BUNDLE_JSON, text);
  writeFileSync(VERSION_TXT, version + "\n");
  console.log(
    `wrote ${BUNDLE_JSON} (${result.bundle.subjects.length} subjects, levels ${content.enabledLevels.join(", ")})`,
  );
  console.log(`wrote ${VERSION_TXT} (${version})`);
}

if (process.argv[1]?.endsWith("bundle.ts")) main();
