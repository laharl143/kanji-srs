import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { ContentSubject } from "../../src/lib/content/types";
import { BUNDLE_JSON, bundleSubjects, contentVersion, VERSION_TXT, type Mnemonics } from "./bundle";

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
  readings: type === "radical" ? [] : [{ text: "x", primary: true }],
  componentIds,
  jlpt: type === "radical" ? null : 5,
  frequency: type === "kanji" ? 10 : null,
});

const subjects: ContentSubject[] = [
  subject(1, "radical", "一", 1),
  subject(2, "radical", "卜", 1),
  subject(3, "kanji", "上", 1, [1, 2]),
  subject(4, "vocab", "上", 1, [3]),
  subject(5, "kanji", "下", 2, [1, 2]),
];

const mnemonics = (): Mnemonics => ({
  radicals: {
    一: { name: "Plank", meaningMnemonic: "A plank." },
    卜: { name: "fortune stick", meaningMnemonic: "A stick." },
  },
  kanji: {
    上: {
      meaningMnemonic: "A FORTUNE STICK stands on a plank, pointing above.",
      readingMnemonic: "A joker.",
    },
  },
  vocab: { 上: { readingMnemonic: "Uses うえ." } },
});

describe("bundleSubjects", () => {
  it("bundles only enabled levels and turns a radical's name into its primary meaning", () => {
    const result = bundleSubjects(subjects, mnemonics(), [1]);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.bundle.subjects.map((s) => s.id)).toEqual([1, 2, 3, 4]);
    expect(result.bundle.subjects[0]).toMatchObject({
      meanings: [{ text: "Plank", primary: true }],
      readings: [],
      meaningMnemonic: "A plank.",
      readingMnemonic: null,
      jlpt: null,
      frequency: null,
    });
    expect(result.bundle.subjects[2]).toMatchObject({ readingMnemonic: "A joker." });
    expect(result.bundle.subjects[3]).toMatchObject({
      meaningMnemonic: "",
      readingMnemonic: "Uses うえ.",
    });
  });

  it("refuses when an enabled subject has no mnemonic", () => {
    const m = mnemonics();
    delete m.vocab["上"];
    const result = bundleSubjects(subjects, m, [1]);
    expect(result).toEqual({
      ok: false,
      errors: ["vocab 上 (id 4, level 1): missing reading mnemonic"],
    });
  });

  it("refuses when a kanji meaning mnemonic does not name every radical", () => {
    const m = mnemonics();
    m.kanji["上"].meaningMnemonic = "A plank points above.";
    const result = bundleSubjects(subjects, m, [1]);
    expect(result).toEqual({
      ok: false,
      errors: ['kanji 上 (id 3, level 1): meaning mnemonic does not name radical "fortune stick"'],
    });
  });

  it("ignores missing mnemonics outside the enabled levels", () => {
    expect(bundleSubjects(subjects, mnemonics(), [1]).ok).toBe(true);
    expect(bundleSubjects(subjects, mnemonics(), [1, 2]).ok).toBe(false);
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
