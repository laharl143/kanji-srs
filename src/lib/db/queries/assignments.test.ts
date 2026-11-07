import { beforeEach, describe, expect, it } from "vitest";

import { subject } from "../../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../../tests/unit/db/harness";
import {
  countDue,
  countLessons,
  getAssignments,
  getDueReviews,
  getForecast,
  getLessonQueue,
  getLevelProgress,
  getOrphanAssignments,
  getScheduledAssignments,
  getStageCounts,
  insertAssignmentsIfMissing,
  promoteLevelForTesting,
  raiseAssignmentsBelowLevel,
  updateAssignment,
} from "./assignments";
import { getReviews } from "./reviews";
import { upsertSubjects } from "./subjects";

const U = "local";
let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await upsertSubjects(db, [
    subject({ id: 1, type: "vocab", level: 1, position: 1 }),
    subject({ id: 2, type: "kanji", level: 1, position: 1 }),
    subject({ id: 3, type: "radical", level: 1, position: 2 }),
    subject({ id: 4, type: "radical", level: 1, position: 1 }),
    subject({ id: 5, type: "radical", level: 2, position: 1 }),
    subject({ id: 6, type: "kanji", level: 3, position: 1 }),
  ]);
});

describe("assignments queries", () => {
  it("getLessonQueue orders by level, then radical, kanji, vocab, then position, capped", async () => {
    await insertAssignmentsIfMissing(
      db,
      U,
      [1, 2, 3, 4, 5].map((subjectId) => ({ subjectId, unlockedAt: 0 })),
    );
    const queue = await getLessonQueue(db, U, 10);
    expect(queue.map((r) => r.subject.id)).toEqual([4, 3, 2, 1, 5]);
    expect(queue[0]?.assignment.srsStage).toBe(0);
    expect(await getLessonQueue(db, U, 2)).toHaveLength(2);
    expect(await countLessons(db, U)).toBe(5);
  });

  it("getDueReviews returns stage 1 to 8 rows due at now, ordered by time then id", async () => {
    await insertAssignmentsIfMissing(db, U, [
      { subjectId: 1, srsStage: 2, unlockedAt: 0, availableAt: 200 },
      { subjectId: 2, srsStage: 1, unlockedAt: 0, availableAt: 100 },
      { subjectId: 3, srsStage: 8, unlockedAt: 0, availableAt: 100 },
      { subjectId: 4, srsStage: 9, unlockedAt: 0, availableAt: 50 },
      { subjectId: 5, srsStage: 0, unlockedAt: 0, availableAt: 50 },
      { subjectId: 6, srsStage: 3, unlockedAt: 0, availableAt: 201 },
    ]);
    const due = await getDueReviews(db, U, 200);
    expect(due.map((r) => r.subject.id)).toEqual([2, 3, 1]);
    expect(await countDue(db, U, 200)).toBe(3);
    expect(await countDue(db, "someone else", 200)).toBe(0);
  });

  it("countDue matches the queue when a subject is missing, and the orphan is reported", async () => {
    await insertAssignmentsIfMissing(db, U, [
      { subjectId: 1, srsStage: 2, unlockedAt: 0, availableAt: 10 },
      { subjectId: 999, srsStage: 2, unlockedAt: 0, availableAt: 10 },
      { subjectId: 998, srsStage: 0, unlockedAt: 0 },
    ]);
    expect(await countDue(db, U, 100)).toBe((await getDueReviews(db, U, 100)).length);
    expect(await countDue(db, U, 100)).toBe(1);
    expect(await countLessons(db, U)).toBe(0);
    expect((await getOrphanAssignments(db, U)).map((a) => a.subjectId)).toEqual([998, 999]);
  });

  it("getForecast returns raw times in [from, to) for stages 1 to 8", async () => {
    await insertAssignmentsIfMissing(db, U, [
      { subjectId: 1, srsStage: 1, unlockedAt: 0, availableAt: 100 },
      { subjectId: 2, srsStage: 4, unlockedAt: 0, availableAt: 150 },
      { subjectId: 3, srsStage: 4, unlockedAt: 0, availableAt: 200 },
      { subjectId: 4, srsStage: 9, unlockedAt: 0, availableAt: 120 },
      { subjectId: 5, srsStage: 2, unlockedAt: 0, availableAt: 99 },
    ]);
    expect(await getForecast(db, U, 100, 200)).toEqual([100, 150]);
  });

  it("getScheduledAssignments lists stage 1 to 8 rows that have a time", async () => {
    await insertAssignmentsIfMissing(db, U, [
      { subjectId: 1, srsStage: 3, unlockedAt: 0, availableAt: 300 },
      { subjectId: 2, srsStage: 1, unlockedAt: 0, availableAt: 100 },
      { subjectId: 3, srsStage: 0, unlockedAt: 0 },
      { subjectId: 4, srsStage: 9, unlockedAt: 0, availableAt: null },
    ]);
    expect(await getScheduledAssignments(db, U)).toEqual([
      { subjectId: 2, srsStage: 1, availableAt: 100 },
      { subjectId: 1, srsStage: 3, availableAt: 300 },
    ]);
  });

  it("getStageCounts and getLevelProgress count by stage and by type", async () => {
    await insertAssignmentsIfMissing(db, U, [
      { subjectId: 1, srsStage: 5, unlockedAt: 0 },
      { subjectId: 2, srsStage: 5, unlockedAt: 0 },
      { subjectId: 3, srsStage: 4, unlockedAt: 0 },
      { subjectId: 4, srsStage: 7, unlockedAt: 0 },
    ]);
    expect(await getStageCounts(db, U)).toEqual([
      { stage: 4, count: 1 },
      { stage: 5, count: 2 },
      { stage: 7, count: 1 },
    ]);
    expect(await getLevelProgress(db, U, 1)).toEqual([
      { type: "radical", total: 2, passed: 1 },
      { type: "kanji", total: 1, passed: 1 },
      { type: "vocab", total: 1, passed: 1 },
    ]);
  });

  it("insertAssignmentsIfMissing never resets an existing stage", async () => {
    await insertAssignmentsIfMissing(db, U, [{ subjectId: 1, srsStage: 4, unlockedAt: 10 }]);
    await insertAssignmentsIfMissing(db, U, [
      { subjectId: 1, srsStage: 0, unlockedAt: 99 },
      { subjectId: 2, srsStage: 0, unlockedAt: 99 },
    ]);
    const rows = await getAssignments(db, U);
    expect(rows.map((r) => [r.subjectId, r.srsStage, r.unlockedAt])).toEqual([
      [1, 4, 10],
      [2, 0, 99],
    ]);
  });

  it("getAssignments filters by ids and returns [] for an empty list", async () => {
    await insertAssignmentsIfMissing(db, U, [
      { subjectId: 1, unlockedAt: 0 },
      { subjectId: 2, unlockedAt: 0 },
    ]);
    expect((await getAssignments(db, U, [2])).map((r) => r.subjectId)).toEqual([2]);
    expect(await getAssignments(db, U, [])).toEqual([]);
  });

  it("updateAssignment writes only the patched columns", async () => {
    await insertAssignmentsIfMissing(db, U, [{ subjectId: 1, unlockedAt: 5 }]);
    await updateAssignment(db, U, 1, { srsStage: 1, startedAt: 10, availableAt: 20 });
    await updateAssignment(db, U, 1, {});
    const [row] = await getAssignments(db, U, [1]);
    expect(row).toMatchObject({ srsStage: 1, unlockedAt: 5, startedAt: 10, availableAt: 20 });
    expect(row?.passedAt).toBeNull();
  });

  it("promoteLevelForTesting moves stage 0 to 4 rows at the level to stage 4, due now (spec 0006 AC-11)", async () => {
    await insertAssignmentsIfMissing(db, U, [
      // Level 1: a lesson, two in review, and one passed.
      { subjectId: 1, srsStage: 0, unlockedAt: 0 },
      { subjectId: 2, srsStage: 2, unlockedAt: 0, startedAt: 7, availableAt: 900 },
      { subjectId: 3, srsStage: 4, unlockedAt: 0, startedAt: 7, availableAt: 900 },
      { subjectId: 4, srsStage: 5, unlockedAt: 0, startedAt: 7, availableAt: 900, passedAt: 8 },
      // Level 2.
      { subjectId: 5, srsStage: 1, unlockedAt: 0, startedAt: 7, availableAt: 900 },
    ]);
    await insertAssignmentsIfMissing(db, "other", [{ subjectId: 1, srsStage: 0, unlockedAt: 0 }]);

    expect(await promoteLevelForTesting(db, U, 1, 500)).toBe(3);

    const rows = await getAssignments(db, U);
    expect(rows.map((r) => [r.subjectId, r.srsStage, r.startedAt, r.availableAt])).toEqual([
      [1, 4, 500, 500],
      [2, 4, 7, 500],
      [3, 4, 7, 500],
      [4, 5, 7, 900],
      [5, 1, 7, 900],
    ]);
    expect(rows[0]).toMatchObject({ unlockedAt: 0, passedAt: null, burnedAt: null });
    expect(await getAssignments(db, "other")).toEqual([
      expect.objectContaining({ subjectId: 1, srsStage: 0, availableAt: null }),
    ]);
    expect(await getReviews(db, U)).toEqual([]);
    // Nothing at the level: nothing moves.
    expect(await promoteLevelForTesting(db, U, 9, 500)).toBe(0);
  });

  it("raiseAssignmentsBelowLevel inserts missing rows and never lowers a stage", async () => {
    await insertAssignmentsIfMissing(db, U, [
      { subjectId: 1, srsStage: 8, unlockedAt: 0, availableAt: 1 },
      { subjectId: 2, srsStage: 2, unlockedAt: 0, availableAt: 1 },
    ]);
    await raiseAssignmentsBelowLevel(db, U, 3, {
      srsStage: 5,
      unlockedAt: 100,
      startedAt: 100,
      availableAt: 500,
      passedAt: 100,
    });
    const rows = await getAssignments(db, U);
    expect(rows.map((r) => [r.subjectId, r.srsStage])).toEqual([
      [1, 8],
      [2, 5],
      [3, 5],
      [4, 5],
      [5, 5],
    ]);
    expect(rows[0]?.availableAt).toBe(1);
    expect(rows[1]?.availableAt).toBe(500);
  });
});
