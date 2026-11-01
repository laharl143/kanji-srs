import { beforeEach, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "../../../../tests/unit/db/harness";
import { getAssignments, insertAssignmentsIfMissing } from "./assignments";
import { getMeta, setMeta } from "./meta";
import { getNote, upsertNote } from "./notes";
import { resetProgress } from "./progress";
import { getReviews, insertReview } from "./reviews";
import { getOrCreateSettings, updateSettings } from "./settings";

const U = "local";
let db: TestDb;

beforeEach(() => {
  db = createTestDb();
});

function review(id: string, createdAt: number, subjectId = 1) {
  return {
    id,
    userId: U,
    subjectId,
    createdAt,
    startingStage: 1,
    endingStage: 2,
    incorrectMeaningCount: 0,
    incorrectReadingCount: 1,
  };
}

describe("meta", () => {
  it("gets, sets, and replaces a value", async () => {
    expect(await getMeta(db, "content_version")).toBeUndefined();
    await setMeta(db, "content_version", "1");
    await setMeta(db, "content_version", "2");
    expect(await getMeta(db, "content_version")).toBe("2");
  });
});

describe("reviews", () => {
  it("orders history by created_at then id", async () => {
    await insertReview(db, review("b", 10));
    await insertReview(db, review("a", 10));
    await insertReview(db, review("c", 5, 2));
    expect((await getReviews(db, U)).map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect((await getReviews(db, U, 1)).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("rejects a duplicate review id", async () => {
    await insertReview(db, review("same", 1));
    await expect(insertReview(db, review("same", 2))).rejects.toThrow();
  });
});

describe("settings", () => {
  it("creates the defaults once, then updates only patched fields", async () => {
    const created = await getOrCreateSettings(db, U, 1000);
    expect(created).toEqual({
      userId: U,
      currentLevel: 1,
      lessonBatchSize: 5,
      reminderDailyEnabled: true,
      reminderDailyTime: "08:00",
      reminderDueEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      createdAt: 1000,
    });
    await updateSettings(db, U, { lessonBatchSize: 10, reminderDueEnabled: false });
    const again = await getOrCreateSettings(db, U, 2000);
    expect(again).toMatchObject({
      lessonBatchSize: 10,
      reminderDueEnabled: false,
      createdAt: 1000,
    });
  });
});

describe("notes", () => {
  it("keeps left out fields, clears on null, replaces synonyms, and keeps an empty row", async () => {
    expect(await getNote(db, U, 1)).toBeUndefined();
    await upsertNote(db, U, 1, { meaningNote: "m", synonyms: ["a", "b"] }, 10);
    await upsertNote(db, U, 1, { readingNote: "r" }, 20);
    expect(await getNote(db, U, 1)).toMatchObject({
      meaningNote: "m",
      readingNote: "r",
      synonyms: ["a", "b"],
      updatedAt: 20,
    });

    await upsertNote(db, U, 1, { meaningNote: null, readingNote: null, synonyms: [] }, 30);
    expect(await getNote(db, U, 1)).toMatchObject({
      meaningNote: null,
      readingNote: null,
      synonyms: [],
      updatedAt: 30,
    });
  });
});

describe("resetProgress", () => {
  it("empties progress, sets level 1, and keeps other settings and app_meta", async () => {
    await getOrCreateSettings(db, U, 1);
    await updateSettings(db, U, {
      currentLevel: 4,
      reminderDailyTime: "07:30",
      lessonBatchSize: 8,
    });
    await setMeta(db, "notif_permission_asked", "1");
    await insertAssignmentsIfMissing(db, U, [{ subjectId: 1, srsStage: 3, unlockedAt: 0 }]);
    await insertAssignmentsIfMissing(db, "other", [{ subjectId: 1, srsStage: 3, unlockedAt: 0 }]);
    await insertReview(db, review("r1", 1));
    await upsertNote(db, U, 1, { meaningNote: "x" }, 1);

    await resetProgress(db, U, 99);

    expect(await getAssignments(db, U)).toEqual([]);
    expect(await getAssignments(db, "other")).toHaveLength(1);
    expect(await getReviews(db, U)).toEqual([]);
    expect(await getNote(db, U, 1)).toBeUndefined();
    expect(await getOrCreateSettings(db, U, 99)).toMatchObject({
      currentLevel: 1,
      reminderDailyTime: "07:30",
      lessonBatchSize: 8,
      createdAt: 1,
    });
    expect(await getMeta(db, "notif_permission_asked")).toBe("1");
  });
});
