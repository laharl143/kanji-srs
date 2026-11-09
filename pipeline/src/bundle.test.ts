import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { ContentSubject } from "../../src/lib/content/types";
import { buildBundle, bundleSubjects, contentVersion } from "./bundle";
import { BUNDLE_JSON, VERSION_TXT, type Content } from "./content";
import { formatLine } from "./validate";

const subject = (
  id: number,
  type: ContentSubject["type"],
  characters: string,
  level: number,
  componentIds: number[] = [],
): ContentSubject => ({
  id,
  type,
  characters,
  level,
  position: id,
  meanings: type === "radical" ? [] : [{ text: characters, primary: true }],
  readings:
    type === "radical"
      ? []
      : [{ text: type === "kanji" ? "じょう" : "うえ", kind: "onyomi", primary: true }],
  componentIds,
  jlpt: type === "radical" ? null : 5,
  frequency: type === "kanji" ? 10 : null,
});

const content = (): Content => ({
  subjects: [
    subject(1, "radical", "一", 1),
    subject(2, "radical", "卜", 1),
    subject(3, "kanji", "上", 1, [1, 2]),
    subject(4, "vocab", "上", 1, [3]),
    subject(5, "kanji", "下", 2, [1, 2]),
  ],
  mnemonics: {
    radicals: {
      一: { name: "Plank", meaningMnemonic: "A plank." },
      卜: { name: "fortune stick", meaningMnemonic: "A stick." },
    },
    kanji: {
      上: {
        meaningMnemonic: "A FORTUNE STICK stands on a plank. It points above.",
        readingMnemonic: "A joker.",
      },
    },
    vocab: { 上: { readingMnemonic: "Uses うえ." } },
  },
  soundHooks: { じょう: "joker" },
  enabledLevels: [1],
  shipped: [],
  retired: [],
});

describe("bundleSubjects", () => {
  it("bundles only enabled levels and turns a radical's name into its primary meaning", () => {
    const c = content();
    const bundle = bundleSubjects(c.subjects, c.mnemonics, [1]);
    expect(bundle.subjects.map((s) => s.id)).toEqual([1, 2, 3, 4]);
    expect(bundle.subjects[0]).toMatchObject({
      meanings: [{ text: "Plank", primary: true }],
      readings: [],
      meaningMnemonic: "A plank.",
      readingMnemonic: null,
      jlpt: null,
      frequency: null,
    });
    expect(bundle.subjects[2]).toMatchObject({ readingMnemonic: "A joker." });
    expect(bundle.subjects[3]).toMatchObject({
      meaningMnemonic: "",
      readingMnemonic: "Uses うえ.",
    });
  });
});

describe("buildBundle", () => {
  it("bundles content that passes validation", () => {
    const result = buildBundle(content());
    if (!result.ok) throw new Error(result.failures.map(formatLine).join("\n"));
    expect(result.bundle.subjects).toHaveLength(4);
  });

  it("refuses when an enabled subject has no mnemonic", () => {
    const c = content();
    delete c.mnemonics.vocab["上"];
    const result = buildBundle(c);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map(formatLine)).toEqual([
      "[enabled-has-mnemonic] vocab:上 (level 1): level is enabled, but vocab.json has no readingMnemonic",
    ]);
  });

  it("refuses when a kanji meaning mnemonic does not name every radical", () => {
    const c = content();
    c.mnemonics.kanji["上"].meaningMnemonic = "A plank stands up. It points above.";
    const result = buildBundle(c);
    expect(result.ok ? [] : result.failures.map(formatLine)).toEqual([
      '[kanji-names-radicals] kanji:上 (level 1): meaning mnemonic does not name radical "fortune stick" (卜)',
    ]);
  });

  it("refuses on any rule, such as a reading mnemonic that skips its sound hook", () => {
    const c = content();
    c.mnemonics.kanji["上"].readingMnemonic = "Read it じょう.";
    const result = buildBundle(c);
    expect(result.ok ? [] : result.failures.map((f) => f.rule)).toEqual(["sound-hook"]);
  });

  it("ignores missing mnemonics outside the enabled levels", () => {
    expect(buildBundle(content()).ok).toBe(true);
    expect(buildBundle({ ...content(), enabledLevels: [1, 2] }).ok).toBe(false);
  });
});

describe("contentVersion", () => {
  it("is the SHA-256 of the bundle text", () => {
    expect(contentVersion("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("shipped content", () => {
  it("content-version.txt is the hash of the committed bundle.json", () => {
    const version = readFileSync(VERSION_TXT, "utf8").trim();
    expect(contentVersion(readFileSync(BUNDLE_JSON, "utf8"))).toBe(version);
  });
});
