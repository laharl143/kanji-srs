import { beforeEach, describe, expect, it } from "vitest";

import { subject } from "../../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../../tests/unit/db/harness";
import { insertAssignmentsIfMissing } from "./assignments";
import {
  getLevelSummaries,
  getSubject,
  getSubjectsByIds,
  getSubjectsByLevel,
  getUnlockInputs,
  getUsedIn,
  upsertSubjects,
} from "./subjects";

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await upsertSubjects(db, [
    subject({ id: 1, type: "radical", level: 1, position: 2 }),
    subject({ id: 2, type: "radical", level: 1, position: 1 }),
    subject({ id: 3, type: "kanji", level: 1, position: 1, componentIds: [1, 2] }),
    subject({ id: 4, type: "vocab", level: 1, position: 1, componentIds: [3] }),
    subject({ id: 5, type: "kanji", level: 2, position: 1, componentIds: [1] }),
  ]);
});

describe("subjects queries", () => {
  it("getSubject returns the full row or undefined", async () => {
    const s = await getSubject(db, 3);
    expect(s?.meaningMnemonic).toBe("mnemonic 3");
    expect(s?.componentIds).toEqual([1, 2]);
    expect(await getSubject(db, 99)).toBeUndefined();
  });

  it("getSubjectsByLevel orders by type then position and leaves out mnemonics", async () => {
    const rows = await getSubjectsByLevel(db, 1);
    expect(rows.map((r) => r.id)).toEqual([2, 1, 3, 4]);
    expect(rows[0]).not.toHaveProperty("meaningMnemonic");
    expect(rows[0]).not.toHaveProperty("readingMnemonic");
  });

  it("getSubjectsByIds returns id order and [] for no ids", async () => {
    expect((await getSubjectsByIds(db, [5, 1, 3])).map((r) => r.id)).toEqual([1, 3, 5]);
    expect(await getSubjectsByIds(db, [])).toEqual([]);
  });

  it("getUsedIn finds subjects whose components contain the id", async () => {
    expect((await getUsedIn(db, 1)).map((r) => r.id)).toEqual([3, 5]);
    expect((await getUsedIn(db, 3)).map((r) => r.id)).toEqual([4]);
    expect(await getUsedIn(db, 4)).toEqual([]);
  });

  it("getUnlockInputs returns subjects up to the level", async () => {
    const rows = await getUnlockInputs(db, 1);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4]);
    expect(rows[2]).toEqual({ id: 3, type: "kanji", level: 1, componentIds: [1, 2] });
  });

  it("getLevelSummaries counts subjects and passed assignments per level", async () => {
    await insertAssignmentsIfMissing(db, "local", [
      { subjectId: 1, srsStage: 5, unlockedAt: 0 },
      { subjectId: 2, srsStage: 4, unlockedAt: 0 },
      { subjectId: 5, srsStage: 9, unlockedAt: 0 },
    ]);
    await insertAssignmentsIfMissing(db, "other", [{ subjectId: 3, srsStage: 6, unlockedAt: 0 }]);
    expect(await getLevelSummaries(db, "local")).toEqual([
      { level: 1, total: 4, passed: 1 },
      { level: 2, total: 1, passed: 1 },
    ]);
  });

  it("upsertSubjects updates by id, never deletes, and rejects a type and characters clash", async () => {
    await upsertSubjects(db, [subject({ id: 1, meaningMnemonic: "changed", level: 3 })]);
    expect((await getSubject(db, 1))?.meaningMnemonic).toBe("changed");
    expect((await getSubject(db, 1))?.level).toBe(3);
    expect(await getSubject(db, 2)).toBeDefined();

    await expect(
      upsertSubjects(db, [subject({ id: 50, type: "radical", characters: "c2" })]),
    ).rejects.toThrow();
  });

  it("upsertSubjects handles more rows than one batch", async () => {
    const many = Array.from({ length: 450 }, (_, i) => subject({ id: 1000 + i, level: 10 }));
    await upsertSubjects(db, many);
    expect(await getSubjectsByLevel(db, 10)).toHaveLength(450);
  });
});
