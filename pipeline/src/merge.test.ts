import { describe, expect, it } from "vitest";

import { course, on, subject } from "../fixtures/course";
import { planBatches, type BatchFile, type BatchItem } from "./batch";
import type { Content } from "./content";
import { mergeBatch } from "./merge";
import { formatLine } from "./validate";

const plan = (content: Content, levels = [2]) =>
  planBatches(content, levels, new Set(), { firstNumber: 1, createdAt: "2026-11-02T00:00:00.000Z" })
    .files;

// Fills items by characters with the given fields, as Claude Code would in the batch file.
function fill(batch: BatchFile, fields: Record<string, Record<string, unknown>>): BatchFile {
  return {
    ...batch,
    items: batch.items.map((item) => {
      const extra = fields[item.characters];
      if (!extra) return item;
      const { hook, ...rest } = extra;
      const filled = { ...item, ...rest } as BatchItem;
      if (filled.type === "kanji" && typeof hook === "string") {
        filled.soundHook = { ...filled.soundHook, hook };
      }
      return filled;
    }),
  };
}

const radicals = (c: Content) =>
  fill(plan(c)[0], {
    口: { name: "hatch", meaningMnemonic: "A square hatch in the deck." },
    丨: { name: "pole", meaningMnemonic: "A pole stands upright." },
  });

const below = {
  meaningMnemonic: "A fortune stick hangs under a plank. It points below.",
  readingMnemonic: "You park the car below the plank. Car sounds like か.",
  hook: "car",
};

// The content after a successful merge, as merge leaves it for the next batch.
function after(c: Content, batch: BatchFile): Content {
  const result = mergeBatch(batch, c);
  if (result.status !== "merged" && result.status !== "noop") {
    throw new Error(`expected a merge, got ${result.status}`);
  }
  return { ...c, mnemonics: result.mnemonics, soundHooks: result.soundHooks };
}

const failures = (batch: BatchFile, c: Content) => {
  const result = mergeBatch(batch, c);
  return result.status === "refused" ? result.failures.map(formatLine) : [result.status];
};

describe("mergeBatch", () => {
  it("merges a filled radical batch, adding new keys at the end in batch order", () => {
    const c = course();
    const result = mergeBatch(radicals(c), c);
    expect(result.status).toBe("merged");
    if (result.status !== "merged") return;
    expect(Object.keys(result.mnemonics.radicals)).toEqual(["一", "卜", "口", "丨"]);
    expect(result.mnemonics.radicals["口"]).toEqual({
      name: "hatch",
      meaningMnemonic: "A square hatch in the deck.",
    });
    expect(c.mnemonics.radicals).not.toHaveProperty("口");
  });

  it("trims what it copies", () => {
    const c = course();
    const batch = fill(radicals(c), { 口: { name: " hatch ", meaningMnemonic: " A hatch. " } });
    const result = mergeBatch(batch, c);
    expect(result.status === "merged" && result.mnemonics.radicals["口"]).toEqual({
      name: "hatch",
      meaningMnemonic: "A hatch.",
    });
  });

  it("merges a kanji batch and adds the new sound hook", () => {
    const c = course();
    const result = mergeBatch(fill(plan(c)[1], { 下: below }), c);
    expect(result.status).toBe("merged");
    if (result.status !== "merged") return;
    expect(result.soundHooks).toEqual({ じょう: "joker", か: "car" });
    expect(Object.keys(result.mnemonics.kanji)).toEqual(["上", "下"]);
    expect(result.mnemonics.kanji["下"]).toEqual({
      meaningMnemonic: below.meaningMnemonic,
      readingMnemonic: below.readingMnemonic,
    });
  });

  it("merges a vocab batch, leaving out an empty meaning mnemonic", () => {
    const c = after(course(), fill(plan(course())[1], { 下: below }));
    const vocab = plan(c).find((f) => f.items[0].type === "vocab")!;
    const result = mergeBatch(
      fill(vocab, { 上下: { readingMnemonic: "Both on'yomi: じょう plus げ, so じょうげ." } }),
      c,
    );
    expect(result.status === "merged" && result.mnemonics.vocab["上下"]).toEqual({
      readingMnemonic: "Both on'yomi: じょう plus げ, so じょうげ.",
    });
  });

  it("skips a batch that is not filled yet; a prefilled hook does not count", () => {
    const c = course();
    expect(mergeBatch(plan(c)[0], c)).toEqual({ status: "skipped" });
    c.soundHooks["か"] = "car";
    expect(mergeBatch(plan(c)[1], c)).toEqual({ status: "skipped" });
  });

  it("a rerun of a merged batch is a no op", () => {
    const c = course();
    const batch = radicals(c);
    const merged = after(c, batch);
    expect(mergeBatch(batch, merged)).toEqual({
      status: "noop",
      mnemonics: merged.mnemonics,
      soundHooks: merged.soundHooks,
    });
  });

  it("refuses the whole batch when one kanji story misses a radical name", () => {
    const c = after(course(), radicals(course()));
    const kanji = plan(c)[0];
    expect(kanji.items.map((i) => i.characters)).toEqual(["中", "下"]);
    const batch = fill(kanji, {
      中: {
        meaningMnemonic: "A pole goes through the hatch. It sits right in the middle.",
        readingMnemonic: "You chew in the middle. Chew sounds like ちゅう.",
        hook: "chew",
      },
      下: { ...below, meaningMnemonic: "A plank points down. It points below." },
    });
    expect(mergeBatch(batch, c)).toEqual({
      status: "refused",
      failures: [
        {
          rule: "kanji-names-radicals",
          subject: "kanji:下",
          level: 2,
          message: 'meaning mnemonic does not name radical "fortune stick" (卜)',
        },
      ],
    });
  });

  it("refuses a stale batch whose items no longer match subjects.json", () => {
    const batch = radicals(course());
    const rebuilt = course();
    rebuilt.subjects[5] = { ...rebuilt.subjects[5], characters: "亅" };
    expect(failures(batch, rebuilt)).toEqual([
      "[batch-identity] radical:丨 (level 2): id 6 is now radical:亅: plan a fresh batch with pipeline:batch",
    ]);
  });

  it("refuses a kanji whose sound hook reading is not its first primary reading", () => {
    const c = course();
    const batch = fill(plan(c)[1], { 下: below });
    const item = batch.items[0];
    if (item.type === "kanji") item.soundHook.reading = "げ";
    expect(failures(batch, c)).toContain(
      "[batch-identity] kanji:下 (level 2): soundHook.reading げ is not its first primary reading か",
    );
  });

  it("refuses a partly filled batch", () => {
    const c = course();
    const batch = fill(radicals(c), { 丨: { meaningMnemonic: "" } });
    expect(failures(batch, c)).toEqual([
      "[batch-filled] radical:丨 (level 2): still empty: meaningMnemonic",
    ]);
    const kanji = fill(plan(c)[1], { 下: { ...below, hook: "" } });
    expect(failures(kanji, c)).toContain(
      "[batch-filled] kanji:下 (level 2): still empty: soundHook.hook",
    );
  });

  it("refuses a batch that would overwrite different text", () => {
    const c = course();
    const merged = after(c, radicals(c));
    const changed = fill(radicals(c), { 口: { name: "trapdoor" } });
    expect(failures(changed, merged)).toEqual([
      "[no-overwrite] radical:口 (level 2): radicals.json already has a different name: a batch never overwrites written text",
    ]);
  });

  it("refuses two kanji in one batch that give one new reading different hooks", () => {
    const c = after(course(), radicals(course()));
    c.subjects.push(
      subject(12, "kanji", "沖", 2, 3, {
        components: [5, 6],
        readings: [on("ちゅう")],
        meanings: ["offing"],
      }),
    );
    const batch = fill(plan(c)[0], {
      中: {
        meaningMnemonic: "A pole goes through the hatch. It sits right in the middle.",
        readingMnemonic: "You chew in the middle. Chew sounds like ちゅう.",
        hook: "chew",
      },
      下: below,
      沖: {
        meaningMnemonic: "You sail past the hatch and the pole. Beyond lies the open offing.",
        readingMnemonic: "Ride the chute out to the offing. Chute sounds like ちゅう.",
        hook: "chute",
      },
    });
    expect(failures(batch, c)).toEqual([
      '[hook-consistent] kanji:沖 (level 2): gives reading ちゅう the hook "chute", but kanji:中 in this batch gives it "chew"',
      '[sound-hook] kanji:沖 (level 2): reading mnemonic does not use the hook "chew" (for ちゅう) at the start of a word',
    ]);
  });

  it("refuses a changed prefilled hook", () => {
    const c = course();
    c.soundHooks["か"] = "car";
    const batch = fill(plan(c)[1], {
      下: { ...below, readingMnemonic: "A cart rolls below. Cart sounds like か.", hook: "cart" },
    });
    expect(failures(batch, c)).toEqual([
      '[hook-consistent] kanji:下 (level 2): reading か already has the hook "car" in sound-hooks.json: keep it',
    ]);
  });

  it("refuses a hook that another reading already uses", () => {
    const c = course();
    const batch = fill(plan(c)[1], {
      下: {
        ...below,
        readingMnemonic: "A joker crawls below. Joker sounds like か.",
        hook: "joker",
      },
    });
    expect(failures(batch, c)).toEqual([
      '[unique-sound-hooks] reading:か (level -): hook "joker" is also used by reading:じょう',
    ]);
  });

  it("refuses a hook that is not one lowercase word, and a story that skips its hook", () => {
    const c = course();
    expect(failures(fill(plan(c)[1], { 下: { ...below, hook: "Car" } }), c)).toEqual([
      '[hook-format] reading:か (level -): hook "Car" is not one lowercase English word',
    ]);
    const skipped = fill(plan(c)[1], { 下: { ...below, readingMnemonic: "It is read か." } });
    expect(failures(skipped, c)).toEqual([
      '[sound-hook] kanji:下 (level 2): reading mnemonic does not use the hook "car" (for か) at the start of a word',
    ]);
  });

  it("refuses a radical name that is badly shaped or already taken", () => {
    const c = course();
    const batch = fill(radicals(c), { 口: { name: "plank" }, 丨: { name: "a long thin pole" } });
    expect(failures(batch, c)).toEqual([
      '[radical-name-shape] radical:丨 (level 2): name "a long thin pole" is not 1 to 3 words separated by single spaces',
      '[unique-radical-names] radical:口 (level 2): name "plank" is also used by radical:一',
    ]);
  });

  it("ignores problems elsewhere in the course, so an old failure never blocks a merge", () => {
    const c = course();
    c.mnemonics.kanji["上"].meaningMnemonic = "It points above.";
    expect(mergeBatch(radicals(c), c).status).toBe("merged");
  });
});
