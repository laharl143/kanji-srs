import { beforeEach, describe, expect, it, vi } from "vitest";

import { subject } from "../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../tests/unit/db/harness";
import { insertAssignmentsIfMissing } from "@/lib/db/queries/assignments";
import * as notes from "@/lib/db/queries/notes";
import { getNote, getNotes, getSynonyms, upsertNote } from "@/lib/db/queries/notes";
import { getOrCreateSettings } from "@/lib/db/queries/settings";
import { upsertSubjects } from "@/lib/db/queries/subjects";

import { addSynonym, getItemPage, removeSynonym, saveNote } from "./items";
import { loadLessonBatch } from "./lessons";
import { loadReviewSession } from "./reviews";

const USER = "local";
const AT = 1_000_000;
let db: TestDb;

// Radicals 1, 2; kanji 11 (大, from 2 and 1) and 12 (from 1); vocab 31 and 33 at level 1 (33
// first by position) and 32 at level 2, all using 11.
beforeEach(async () => {
  db = createTestDb();
  await upsertSubjects(db, [
    subject({ id: 1, type: "radical", level: 1, position: 1 }),
    subject({ id: 2, type: "radical", level: 1, position: 2 }),
    subject({
      id: 11,
      type: "kanji",
      level: 1,
      characters: "大",
      meanings: [
        { text: "Large", primary: true },
        { text: "Big", primary: false },
      ],
      componentIds: [2, 1],
      readingMnemonic: "reading mnemonic 11",
    }),
    subject({ id: 12, type: "kanji", level: 1, componentIds: [1] }),
    subject({ id: 31, type: "vocab", level: 1, position: 5, componentIds: [11] }),
    subject({ id: 32, type: "vocab", level: 2, position: 1, componentIds: [11] }),
    subject({ id: 33, type: "vocab", level: 1, position: 4, componentIds: [11, 12] }),
  ]);
});

describe("getItemPage", () => {
  it("returns null for an unknown id", async () => {
    expect(await getItemPage(db, USER, 999999)).toBeNull();
  });

  it("loads a locked item with its components in order and stages, and an empty note", async () => {
    await insertAssignmentsIfMissing(db, USER, [
      { subjectId: 1, srsStage: 5, unlockedAt: 0, availableAt: AT },
    ]);
    const page = await getItemPage(db, USER, 11);
    expect(page?.subject.characters).toBe("大");
    expect(page?.subject.readingMnemonic).toBe("reading mnemonic 11");
    expect(page?.assignment).toBeUndefined();
    expect(page?.components.map((c) => [c.id, c.stage])).toEqual([
      [2, null],
      [1, 5],
    ]);
    expect(page?.note).toEqual({ meaningNote: null, readingNote: null, synonyms: [] });
  });

  it("lists used in across levels, ordered by level, type, then position", async () => {
    await insertAssignmentsIfMissing(db, USER, [
      { subjectId: 33, srsStage: 0, unlockedAt: 0, availableAt: null },
    ]);
    const page = await getItemPage(db, USER, 11);
    expect(page?.usedIn.map((c) => [c.id, c.stage])).toEqual([
      [33, 0],
      [31, null],
      [32, null],
    ]);
    const radical = await getItemPage(db, USER, 1);
    expect(radical?.usedIn.map((c) => c.id)).toEqual([11, 12]);
    expect((await getItemPage(db, USER, 31))?.usedIn).toEqual([]);
  });

  it("returns the assignment and your note", async () => {
    await insertAssignmentsIfMissing(db, USER, [
      { subjectId: 11, srsStage: 3, unlockedAt: 0, availableAt: AT },
    ]);
    await upsertNote(db, USER, 11, { meaningNote: "m", synonyms: ["huge"] }, AT);
    const page = await getItemPage(db, USER, 11);
    expect(page?.assignment?.srsStage).toBe(3);
    expect(page?.note).toEqual({ meaningNote: "m", readingNote: null, synonyms: ["huge"] });
  });
});

describe("saveNote", () => {
  it("inserts a row with no assignment, trims, and returns the saved values", async () => {
    const r = await saveNote(db, USER, 11, { meaningNote: "  my note \n" }, AT);
    expect(r).toEqual({
      ok: true,
      note: { meaningNote: "my note", readingNote: null, synonyms: [] },
    });
    expect((await getNote(db, USER, 11))?.updatedAt).toBe(AT);
  });

  it("keeps the other field, and an empty field clears the note", async () => {
    await saveNote(db, USER, 11, { meaningNote: "m", readingNote: "r" }, AT);
    const r = await saveNote(db, USER, 11, { meaningNote: "   " }, AT + 1);
    expect(r).toEqual({ ok: true, note: { meaningNote: null, readingNote: "r", synonyms: [] } });
  });

  it("caps a note at 1000 characters", async () => {
    const r = await saveNote(db, USER, 11, { readingNote: "x".repeat(1200) }, AT);
    expect(r.ok && r.note.readingNote?.length).toBe(1000);
  });

  it("refuses an unknown subject", async () => {
    expect(await saveNote(db, USER, 999, { meaningNote: "m" }, AT)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("throws when the write fails, and writes nothing", async () => {
    const spy = vi.spyOn(notes, "upsertNote").mockRejectedValueOnce(new Error("disk full"));
    await expect(saveNote(db, USER, 11, { meaningNote: "m" }, AT)).rejects.toThrow("disk full");
    spy.mockRestore();
    expect(await getNote(db, USER, 11)).toBeUndefined();
  });
});

describe("addSynonym and removeSynonym", () => {
  it("adds a cleaned synonym that the session loaders then read", async () => {
    expect(await addSynonym(db, USER, 11, "  big   guy ", AT)).toEqual({
      ok: true,
      synonyms: ["big guy"],
    });
    expect(await addSynonym(db, USER, 11, "huge", AT)).toEqual({
      ok: true,
      synonyms: ["big guy", "huge"],
    });
    expect((await getSynonyms(db, USER)).get(11)).toEqual(["big guy", "huge"]);
  });

  it("refuses with a reason and saves nothing", async () => {
    expect(await addSynonym(db, USER, 11, "Large ", AT)).toEqual({
      ok: false,
      error: "invalid",
      reason: "duplicate",
    });
    expect(await addSynonym(db, USER, 11, "おおきい", AT)).toMatchObject({ reason: "not_english" });
    expect(await getNote(db, USER, 11)).toBeUndefined();
  });

  it("refuses a ninth synonym", async () => {
    for (let i = 1; i <= 8; i++) await addSynonym(db, USER, 11, `word${"x".repeat(i)}`, AT);
    expect(await addSynonym(db, USER, 11, "huge", AT)).toMatchObject({ reason: "full" });
  });

  it("does not lose a synonym when two adds race", async () => {
    await Promise.all([addSynonym(db, USER, 11, "huge", AT), addSynonym(db, USER, 11, "vast", AT)]);
    expect((await getNote(db, USER, 11))?.synonyms).toEqual(["huge", "vast"]);
  });

  it("removes the exact stored text and keeps the notes", async () => {
    await saveNote(db, USER, 11, { meaningNote: "m" }, AT);
    await addSynonym(db, USER, 11, "huge", AT);
    await addSynonym(db, USER, 11, "vast", AT);
    expect(await removeSynonym(db, USER, 11, "Huge", AT)).toEqual({
      ok: true,
      synonyms: ["huge", "vast"],
    });
    expect(await removeSynonym(db, USER, 11, "huge", AT)).toEqual({ ok: true, synonyms: ["vast"] });
    expect((await getNote(db, USER, 11))?.meaningNote).toBe("m");
  });

  it("refuses an unknown subject", async () => {
    expect(await addSynonym(db, USER, 999, "huge", AT)).toEqual({ ok: false, error: "not_found" });
    expect(await removeSynonym(db, USER, 999, "huge", AT)).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("getNotes", () => {
  it("returns notes per subject and leaves out rows with both notes empty", async () => {
    await upsertNote(db, USER, 11, { meaningNote: "m" }, AT);
    await upsertNote(db, USER, 12, { synonyms: ["x"] }, AT);
    await upsertNote(db, USER, 1, { meaningNote: "  ", readingNote: "r" }, AT);
    await upsertNote(db, "other", 2, { meaningNote: "theirs" }, AT);
    const map = await getNotes(db, USER);
    expect([...map.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [1, { meaningNote: null, readingNote: "r" }],
      [11, { meaningNote: "m", readingNote: null }],
    ]);
  });
});

describe("session details (AC-7)", () => {
  it("lesson batches and review sessions carry mnemonics and your notes", async () => {
    await getOrCreateSettings(db, USER, AT);
    await insertAssignmentsIfMissing(db, USER, [
      { subjectId: 11, srsStage: 0, unlockedAt: 0, availableAt: null },
      { subjectId: 12, srsStage: 2, unlockedAt: 0, availableAt: AT },
    ]);
    await saveNote(db, USER, 11, { readingNote: "think of a giant" }, AT);
    await saveNote(db, USER, 12, { meaningNote: "my meaning" }, AT);

    const [lesson] = await loadLessonBatch(db, USER);
    expect(lesson.details).toEqual({
      meaningMnemonic: "mnemonic 11",
      readingMnemonic: "reading mnemonic 11",
      meaningNote: null,
      readingNote: "think of a giant",
    });

    const [review] = await loadReviewSession(db, USER, new Date(AT));
    expect(review.details).toEqual({
      meaningMnemonic: "mnemonic 12",
      readingMnemonic: null,
      meaningNote: "my meaning",
      readingNote: null,
    });
  });
});
