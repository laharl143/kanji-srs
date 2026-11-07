import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { subject } from "../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../tests/unit/db/harness";
import { runStartup } from "@/lib/content/startup";
import type { BundledContent, BundleSubject } from "@/lib/content/types";
import {
  getAssignments,
  insertAssignmentsIfMissing,
  updateAssignment,
} from "@/lib/db/queries/assignments";
import { getReviews } from "@/lib/db/queries/reviews";
import { getSettings, updateSettings } from "@/lib/db/queries/settings";
import { userSettings, type NewSubject } from "@/lib/db/schema";
import { withTransaction } from "@/lib/db/transaction";

import { getHomeCounts } from "./home";
import { completeLessonItem, loadLessonBatch } from "./lessons";
import { runProgression } from "./progression";
import { loadReviewSession, submitReview, type ReviewResult } from "./reviews";

const USER = "local";
const START = new Date("2026-11-07T09:00:00Z");

// Level 1: radicals 1 to 3, ten kanji (4 to 13) built from them, and a word (14) built on kanji 4.
const level1: NewSubject[] = [
  subject({ id: 1, type: "radical", level: 1 }),
  subject({ id: 2, type: "radical", level: 1 }),
  subject({ id: 3, type: "radical", level: 1 }),
  ...Array.from({ length: 10 }, (_, i) =>
    subject({ id: 4 + i, type: "kanji", level: 1, componentIds: i % 2 === 0 ? [1, 2] : [2, 3] }),
  ),
  subject({ id: 14, type: "vocab", level: 1, componentIds: [4] }),
];
// Level 2, the top level at first: two radicals, kanji 22 built from level 1 radical 1, and
// kanji 23 built from level 2 radical 20.
const level2: NewSubject[] = [
  subject({ id: 20, type: "radical", level: 2 }),
  subject({ id: 21, type: "radical", level: 2 }),
  subject({ id: 22, type: "kanji", level: 2, componentIds: [1] }),
  subject({ id: 23, type: "kanji", level: 2, componentIds: [20] }),
];
// Level 3 arrives later in a new bundle.
const level3: NewSubject[] = [
  subject({ id: 30, type: "radical", level: 3 }),
  subject({ id: 31, type: "kanji", level: 3, componentIds: [30] }),
];

const bundle = (version: string, rows: NewSubject[]): BundledContent => ({
  version,
  bundle: { subjects: rows as BundleSubject[] },
});

let db: TestDb;
let clock: Date;

beforeEach(async () => {
  db = createTestDb();
  clock = START;
  await runStartup(db, USER, bundle("v1", [...level1, ...level2]), clock);
});

const lessonQueue = async () => (await loadLessonBatch(db, USER)).map((i) => i.subject.id);
const stages = async (...ids: number[]) =>
  (await getAssignments(db, USER, ids)).map((a) => a.srsStage);
const currentLevel = async () => (await getSettings(db, USER))?.currentLevel;

// Finishes these lessons now, as the lesson quiz does when every answer is right.
async function learn(ids: number[]) {
  for (const id of ids) {
    expect(await completeLessonItem(db, USER, id, clock)).toEqual({ ok: true });
  }
}

// Round after round: moves the clock to the next due time, then reviews everything due with
// every answer right, in the order the session loads it, until `done` holds.
async function reviewUntil(done: () => Promise<boolean>): Promise<ReviewResult[]> {
  const results: ReviewResult[] = [];
  for (let round = 0; !(await done()); round++) {
    if (round === 20) throw new Error("still not done after 20 review rounds");
    const due = (await getAssignments(db, USER))
      .filter((a) => a.srsStage >= 1 && a.srsStage <= 8)
      .map((a) => a.availableAt!);
    if (due.length === 0) throw new Error("nothing left to review");
    clock = new Date(Math.max(clock.getTime(), Math.min(...due)));
    for (const item of await loadReviewSession(db, USER, clock)) {
      const input = { subjectId: item.subject.id, wrongMeaning: 0, wrongReading: 0 };
      const result = await submitReview(db, USER, input, clock, randomUUID);
      if (!result.ok) throw new Error(`review not saved: ${result.error}`);
      results.push(result);
    }
  }
  return results;
}

describe("SRS progression loop (spec 0006 AC-12, AC-13)", () => {
  it("passing the radicals unlocks their kanji, and 90% of the kanji opens level 2", async () => {
    // First launch: only the level 1 radicals wait as lessons.
    expect(await lessonQueue()).toEqual([1, 2, 3]);
    await learn([1, 2, 3]);

    // Four review rounds take the radicals from stage 1 to 5. In the last one, radical 2 completes
    // the kanji built from 一 and 卜 (radicals 1 and 2), and radical 3 the rest.
    const radicalReviews = await reviewUntil(async () =>
      (await stages(1, 2, 3)).every((s) => s >= 5),
    );
    expect(radicalReviews.map((r) => r.unlocked)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5]);
    expect(radicalReviews.slice(-3).map((r) => [r.startingStage, r.newStage])).toEqual([
      [4, 5],
      [4, 5],
      [4, 5],
    ]);
    expect((await getHomeCounts(db, USER, clock)).lessons).toBe(10);
    expect(await lessonQueue()).toEqual([4, 5, 6, 7, 8]);
    expect(await getAssignments(db, USER, [14])).toEqual([]);
    expect(await currentLevel()).toBe(1);

    // Nine of the ten kanji go to stage 5; kanji 13 stays a lesson.
    await learn([4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const kanjiReviews = await reviewUntil(async () => (await currentLevel()) === 2);

    // Kanji 4 passing unlocked word 14 (still level 1). Kanji 12, the ninth to pass (90%), opened
    // level 2: its two radicals plus kanji 22, whose radical is already passed.
    const lastRound = kanjiReviews.slice(-9);
    expect(lastRound.map((r) => r.unlocked)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 3]);
    expect(kanjiReviews.filter((r) => r.newLevel !== null)).toEqual([
      { ok: true, startingStage: 4, newStage: 5, unlocked: 3, newLevel: 2 },
    ]);
    expect(lastRound.at(-1)?.newLevel).toBe(2);

    // Lesson order after the level up (AC-12): level 1's waiting kanji and word first, then
    // level 2's radicals, then its kanji. Kanji 23 waits for radical 20.
    expect(await lessonQueue()).toEqual([13, 14, 20, 21, 22]);
    expect(await getAssignments(db, USER, [23])).toEqual([]);
  });

  it("stays at the top level after passing 90% there, until a new bundle adds a level", async () => {
    // Everything through level 2 is passed except kanji 23, at stage 4 and due now.
    await updateSettings(db, USER, { currentLevel: 2 });
    const all = [...level1, ...level2].map((s) => s.id!);
    await insertAssignmentsIfMissing(
      db,
      USER,
      all.map((subjectId) => ({ subjectId, srsStage: 5, unlockedAt: 0 })),
    );
    for (const id of all) await updateAssignment(db, USER, id, { srsStage: 5 });
    await updateAssignment(db, USER, 23, { srsStage: 4, availableAt: clock.getTime() });

    const result = await submitReview(
      db,
      USER,
      { subjectId: 23, wrongMeaning: 0, wrongReading: 0 },
      clock,
      randomUUID,
    );

    // Both level 2 kanji are passed, but level 2 is the highest level there is.
    expect(result).toEqual({
      ok: true,
      startingStage: 4,
      newStage: 5,
      unlocked: 0,
      newLevel: null,
    });
    expect(await currentLevel()).toBe(2);

    // A launch with a new bundle that adds level 3 levels you up and unlocks its radical.
    clock = new Date(clock.getTime() + 3_600_000);
    await runStartup(db, USER, bundle("v2", [...level1, ...level2, ...level3]), clock);
    expect(await currentLevel()).toBe(3);
    expect(await lessonQueue()).toEqual([30]);
    expect(await getAssignments(db, USER, [31])).toEqual([]);
  });
});

describe("runProgression (spec 0006 AC-4)", () => {
  it("runs on the caller's transaction and returns what it unlocked and the new level", async () => {
    for (const id of [1, 2, 3]) {
      await updateAssignment(db, USER, id, { srsStage: 5 });
    }
    expect(await withTransaction(db, (tx) => runProgression(tx, USER, clock))).toEqual({
      unlocked: 10,
      newLevel: null,
    });
    // Nothing new on a second run.
    expect(await withTransaction(db, (tx) => runProgression(tx, USER, clock))).toEqual({
      unlocked: 0,
      newLevel: null,
    });
  });

  it("throws when the settings row is missing, so the caller rolls back", async () => {
    await db.delete(userSettings);
    await expect(withTransaction(db, (tx) => runProgression(tx, USER, clock))).rejects.toThrow(
      "No user settings",
    );
  });

  it("rolls the whole review back when it throws inside submitReview", async () => {
    await completeLessonItem(db, USER, 1, clock);
    const later = new Date(clock.getTime() + 4 * 3_600_000);
    const before = await getAssignments(db, USER);
    // With no settings row the progression throws, after the review's own writes.
    await db.delete(userSettings);

    await expect(
      submitReview(db, USER, { subjectId: 1, wrongMeaning: 0, wrongReading: 0 }, later, randomUUID),
    ).rejects.toThrow("No user settings");

    expect(await getAssignments(db, USER)).toEqual(before);
    expect(await getReviews(db, USER)).toEqual([]);
  });
});
