import { describe, expect, it } from "vitest";

import type { ContentSubject } from "../../src/lib/content/types";
import type { Content } from "./content";
import {
  CONTENT_RULES,
  coverage,
  formatLine,
  sentenceCount,
  usesHook,
  validateAll,
  type ContentRuleName,
} from "./validate";

const subject = (
  id: number,
  type: ContentSubject["type"],
  characters: string,
  level: number,
  componentIds: number[] = [],
  readings: ContentSubject["readings"] = type === "radical" ? [] : [{ text: "x", primary: true }],
): ContentSubject => ({
  id,
  type,
  characters,
  level,
  position: id,
  meanings: type === "radical" ? [] : [{ text: characters, primary: true }],
  readings,
  componentIds,
  jlpt: type === "radical" ? null : 5,
  frequency: null,
});

// A small course that passes every rule: level 1 written and enabled, level 2 not written yet.
function course(): Content {
  return {
    subjects: [
      subject(1, "radical", "一", 1),
      subject(2, "radical", "卜", 1),
      subject(
        3,
        "kanji",
        "上",
        1,
        [1, 2],
        [
          { text: "じょう", kind: "onyomi", primary: true },
          { text: "うえ", kind: "kunyomi", primary: false },
        ],
      ),
      subject(4, "vocab", "上", 1, [3], [{ text: "うえ", primary: true }]),
      subject(5, "radical", "口", 2),
      subject(6, "kanji", "中", 2, [5], [{ text: "ちゅう", kind: "onyomi", primary: true }]),
    ],
    mnemonics: {
      radicals: {
        一: { name: "plank", meaningMnemonic: "A plank." },
        卜: { name: "fortune stick", meaningMnemonic: "A stick." },
      },
      kanji: {
        上: {
          meaningMnemonic: "A Fortune Stick stands on a plank. It points above.",
          readingMnemonic: "A joker juggles above you. Joker sounds like じょう.",
        },
      },
      vocab: { 上: { readingMnemonic: "Alone it uses the kun'yomi うえ." } },
    },
    soundHooks: { じょう: "joker" },
    enabledLevels: [1],
    shipped: [
      { id: 1, type: "radical", characters: "一" },
      { id: 2, type: "radical", characters: "卜" },
      { id: 3, type: "kanji", characters: "上" },
      { id: 4, type: "vocab", characters: "上" },
    ],
    retired: [],
  };
}

const lines = (content: Content, rule?: ContentRuleName) =>
  validateAll(content)
    .failures.filter((f) => !rule || f.rule === rule)
    .map(formatLine);

describe("validateAll", () => {
  it("passes a course that keeps every rule, with no warnings", () => {
    expect(validateAll(course())).toEqual({ failures: [], warnings: [] });
  });

  it("checks the rules in the spec's table order", () => {
    expect(CONTENT_RULES).toEqual([
      "radical-before-kanji",
      "kanji-before-vocab",
      "has-meaning-reading",
      "enabled-has-mnemonic",
      "kanji-names-radicals",
      "kanji-story-length",
      "radical-name-shape",
      "unique-radical-names",
      "hook-format",
      "sound-hook",
      "unique-sound-hooks",
      "unique-ids",
      "stable-ids",
      "enabled-levels",
    ]);
  });

  it("radical-before-kanji: fails a kanji whose radical comes in a later level", () => {
    const c = course();
    c.subjects[1].level = 2;
    expect(lines(c, "radical-before-kanji")).toEqual([
      "[radical-before-kanji] kanji:上 (level 1): radical 卜 is in a later level (2)",
    ]);
  });

  it("kanji-before-vocab: fails a vocab whose kanji comes in a later level", () => {
    const c = course();
    c.subjects[3].componentIds = [3, 6];
    expect(lines(c, "kanji-before-vocab")).toEqual([
      "[kanji-before-vocab] vocab:上 (level 1): kanji 中 is in a later level (2)",
    ]);
  });

  it("has-meaning-reading: fails a kanji or vocab with no meaning or no reading", () => {
    const c = course();
    c.subjects[2].meanings = [];
    c.subjects[3].readings = [{ text: " ", primary: true }];
    expect(lines(c, "has-meaning-reading")).toEqual([
      "[has-meaning-reading] kanji:上 (level 1): has no meaning",
      "[has-meaning-reading] vocab:上 (level 1): has no reading",
    ]);
  });

  it("enabled-has-mnemonic: fails an enabled subject with no mnemonic, ignores other levels", () => {
    const c = course();
    c.mnemonics.radicals["卜"].meaningMnemonic = "";
    expect(lines(c, "enabled-has-mnemonic")).toEqual([
      "[enabled-has-mnemonic] radical:卜 (level 1): level is enabled, but radicals.json has no meaningMnemonic",
    ]);
    const enabled = course();
    enabled.enabledLevels = [1, 2];
    expect(lines(enabled, "enabled-has-mnemonic")).toEqual([
      "[enabled-has-mnemonic] radical:口 (level 2): level is enabled, but radicals.json has no name or meaningMnemonic",
      "[enabled-has-mnemonic] kanji:中 (level 2): level is enabled, but kanji.json has no meaningMnemonic or readingMnemonic",
    ]);
  });

  it("kanji-names-radicals: fails a story that misses a radical name, case insensitive", () => {
    const c = course();
    c.mnemonics.kanji["上"].meaningMnemonic = "A plank points above.";
    expect(lines(c, "kanji-names-radicals")).toEqual([
      '[kanji-names-radicals] kanji:上 (level 1): meaning mnemonic does not name radical "fortune stick" (卜)',
    ]);
  });

  it("kanji-names-radicals: fails a written kanji whose radical has no name", () => {
    const c = course();
    c.mnemonics.kanji["中"] = { meaningMnemonic: "A hatch.", readingMnemonic: "Chew it." };
    c.soundHooks["ちゅう"] = "chew";
    expect(lines(c, "kanji-names-radicals")).toEqual([
      "[kanji-names-radicals] kanji:中 (level 2): radical 口 has no name",
    ]);
  });

  it("kanji-story-length: fails a kanji story under 2 or over 4 sentences", () => {
    const c = course();
    c.mnemonics.kanji["上"].meaningMnemonic = "A fortune stick on a plank points above.";
    expect(lines(c, "kanji-story-length")).toEqual([
      "[kanji-story-length] kanji:上 (level 1): meaning mnemonic has 1 sentence, needs 2 to 4",
    ]);
    c.mnemonics.kanji["上"].meaningMnemonic =
      "A plank. A fortune stick. It stands. It waits. It points above.";
    expect(lines(c, "kanji-story-length")).toEqual([
      "[kanji-story-length] kanji:上 (level 1): meaning mnemonic has 5 sentences, needs 2 to 4",
    ]);
    c.mnemonics.kanji["上"].meaningMnemonic = "A plank! Does the fortune stick point above?";
    expect(lines(c, "kanji-story-length")).toEqual([]);
  });

  it("sentenceCount: splits at . ! or ? before a space or the end, after closing quotes", () => {
    expect(sentenceCount("No ending at all")).toBe(1);
    expect(sentenceCount(" One.  Two! Three? ")).toBe(3);
    expect(sentenceCount('He said "stop." Then he left.')).toBe(2);
    expect(sentenceCount("A 3.5 inch plank. It points up.")).toBe(2);
  });

  it("radical-name-shape: fails a name that is not 1 to 3 words with single spaces", () => {
    const c = course();
    c.mnemonics.radicals["一"].name = "a very long plank";
    c.mnemonics.radicals["卜"].name = "fortune  stick";
    expect(lines(c, "radical-name-shape")).toEqual([
      '[radical-name-shape] radical:一 (level 1): name "a very long plank" is not 1 to 3 words separated by single spaces',
      '[radical-name-shape] radical:卜 (level 1): name "fortune  stick" is not 1 to 3 words separated by single spaces',
    ]);
  });

  it("unique-radical-names: fails both radicals that share a name, trimmed and case insensitive", () => {
    const c = course();
    c.mnemonics.radicals["卜"].name = "Plank";
    expect(lines(c, "unique-radical-names")).toEqual([
      '[unique-radical-names] radical:一 (level 1): name "plank" is also used by radical:卜',
      '[unique-radical-names] radical:卜 (level 1): name "plank" is also used by radical:一',
    ]);
  });

  it("hook-format: fails a hook that is not one lowercase English word", () => {
    const c = course();
    c.soundHooks["じょう"] = "Joker";
    c.soundHooks["ちゅう"] = "chew gum";
    expect(lines(c, "hook-format")).toEqual([
      '[hook-format] reading:じょう (level -): hook "Joker" is not one lowercase English word',
      '[hook-format] reading:ちゅう (level -): hook "chew gum" is not one lowercase English word',
    ]);
  });

  it("sound-hook: fails a reading mnemonic with no hook, or one that misses it at a word start", () => {
    const missing = course();
    delete missing.soundHooks["じょう"];
    expect(lines(missing, "sound-hook")).toEqual([
      "[sound-hook] kanji:上 (level 1): sound-hooks.json has no hook for its first primary reading じょう",
    ]);
    const inside = course();
    inside.soundHooks["じょう"] = "joke";
    inside.mnemonics.kanji["上"].readingMnemonic =
      "Do not take it as a nonjoke. It is read じょう.";
    expect(lines(inside, "sound-hook")).toEqual([
      '[sound-hook] kanji:上 (level 1): reading mnemonic does not use the hook "joke" (for じょう) at the start of a word',
    ]);
  });

  it("sound-hook: matches the hook at a word start, so gets counts and forget does not", () => {
    expect(usesHook("He gets a photo.", "get")).toBe(true);
    expect(usesHook("Get it.", "get")).toBe(true);
    expect(usesHook("Do not forget.", "get")).toBe(false);
    expect(usesHook("「get」 sounds like げつ", "get")).toBe(true);
  });

  it("unique-sound-hooks: fails two readings that share a hook word", () => {
    const c = course();
    c.soundHooks["ちゅう"] = "joker";
    expect(lines(c, "unique-sound-hooks")).toEqual([
      '[unique-sound-hooks] reading:じょう (level -): hook "joker" is also used by reading:ちゅう',
      '[unique-sound-hooks] reading:ちゅう (level -): hook "joker" is also used by reading:じょう',
    ]);
  });

  it("unique-ids: fails a shared id, a repeated type and characters, and bad retired entries", () => {
    const c = course();
    c.subjects[5].id = 5;
    c.subjects.push({ ...c.subjects[0], id: 7 });
    c.retired = [
      { id: 8, type: "kanji", characters: "外" },
      { id: 8, type: "kanji", characters: "外" },
      { id: 9, type: "radical", characters: "口" },
    ];
    expect(lines(c, "unique-ids")).toEqual([
      "[unique-ids] kanji:中 (level 2): id 5 is also used by radical:口",
      "[unique-ids] radical:一 (level 1): is in subjects.json twice (ids 1 and 7)",
      "[unique-ids] kanji:外 (level -): retired.json repeats id 8",
      "[unique-ids] radical:口 (level 2): is in both subjects.json and retired.json",
    ]);
  });

  it("stable-ids: fails a changed shipped id", () => {
    const c = course();
    c.subjects[3].id = 40;
    expect(lines(c, "stable-ids")).toEqual([
      "[stable-ids] vocab:上 (level 1): shipped with id 4, but subjects.json gives it id 40",
    ]);
  });

  it("stable-ids: fails a shipped id reused by another item, in the bundle or in retired.json", () => {
    const c = course();
    c.shipped.push({ id: 6, type: "kanji", characters: "外" });
    c.retired = [
      { id: 6, type: "kanji", characters: "外" },
      { id: 5, type: "kanji", characters: "内" },
    ];
    expect(lines(c, "stable-ids")).toEqual([
      "[stable-ids] radical:口 (level 2): id 5 belongs to kanji:内 in retired.json",
      "[stable-ids] kanji:中 (level 2): id 6 already shipped as kanji:外",
      "[stable-ids] kanji:中 (level 2): id 6 belongs to kanji:外 in retired.json",
    ]);
  });

  it("stable-ids: fails a shipped subject that is in neither subjects.json nor retired.json", () => {
    const c = course();
    c.subjects = c.subjects.filter((s) => s.id !== 4);
    expect(lines(c, "stable-ids")).toEqual([
      "[stable-ids] vocab:上 (level -): shipped with id 4, but is in neither subjects.json nor retired.json",
    ]);
  });

  it("stable-ids: only warns on a shipped subject that is now retired with its id", () => {
    const c = course();
    c.subjects = c.subjects.filter((s) => s.id !== 4);
    delete c.mnemonics.vocab["上"];
    c.retired = [{ id: 4, type: "vocab", characters: "上" }];
    const result = validateAll(c);
    expect(result.failures).toEqual([]);
    expect(result.warnings.map(formatLine)).toEqual([
      "[shipped-retired] vocab:上 (level -): shipped, now retired: still on the phone with its old text",
    ]);
  });

  it("stable-ids: fails a retired shipped subject whose retired id differs", () => {
    const c = course();
    c.subjects = c.subjects.filter((s) => s.id !== 4);
    c.retired = [{ id: 44, type: "vocab", characters: "上" }];
    expect(lines(c, "stable-ids")).toEqual([
      "[stable-ids] vocab:上 (level -): shipped with id 4, but retired.json gives it id 44",
    ]);
  });

  it("enabled-levels: fails a gap, a level out of order, and a level with no subjects", () => {
    const gap = course();
    gap.enabledLevels = [1, 3];
    expect(lines(gap, "enabled-levels")).toEqual([
      "[enabled-levels] enabled-levels.json (level -): must be 1 to N in order with no gaps, found [1, 3]",
      "[enabled-levels] enabled-levels.json (level -): level 3 has no subjects",
    ]);
    const order = course();
    order.enabledLevels = [2, 1];
    expect(lines(order, "enabled-levels")).toEqual([
      "[enabled-levels] enabled-levels.json (level -): must be 1 to N in order with no gaps, found [2, 1]",
    ]);
  });

  it("warns on mnemonics that match no subject", () => {
    const c = course();
    c.mnemonics.kanji["外"] = { meaningMnemonic: "Out.", readingMnemonic: "Guy." };
    expect(validateAll(c).warnings.map(formatLine)).toEqual([
      "[orphan-mnemonic] kanji:外 (level -): kanji.json has a mnemonic for it, but no subject matches",
    ]);
  });
});

describe("coverage", () => {
  it("counts written subjects per level and marks enabled levels", () => {
    expect(coverage(course())).toEqual([
      { level: 1, written: 4, total: 4, enabled: true },
      { level: 2, written: 0, total: 2, enabled: false },
    ]);
  });
});
