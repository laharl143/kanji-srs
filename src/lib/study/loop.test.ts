import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { subject } from "../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../tests/unit/db/harness";
import { checkMeaning, checkReading } from "@/lib/answer/check";
import { runStartup } from "@/lib/content/startup";
import type { BundledContent, BundleSubject } from "@/lib/content/types";
import {
  getAssignments,
  insertAssignmentsIfMissing,
  updateAssignment,
} from "@/lib/db/queries/assignments";
import { upsertNote } from "@/lib/db/queries/notes";
import { getReviews } from "@/lib/db/queries/reviews";
import type { Meaning, Reading } from "@/lib/types";

import { loadCourseForms } from "./answers";
import { getHomeCounts } from "./home";
import { completeLessonItem, loadLessonBatch } from "./lessons";
import {
  answerCurrent,
  createQueue,
  currentQuestion,
  questionsFor,
  type CompletedItem,
  type QueueItem,
} from "./queue";
import { loadReviewSession, submitReview } from "./reviews";

const USER = "local";
const HOUR = 3_600_000;
const START = new Date("2026-11-02T09:15:00Z");

// A small level 1: three radicals, one kanji built from two of them, and one vocab.
const fixture: BundledContent = {
  version: "fixture-1",
  bundle: {
    subjects: [
      subject({ id: 1, type: "radical", characters: "一", position: 1 }),
      subject({ id: 2, type: "radical", characters: "卜", position: 2 }),
      subject({ id: 3, type: "radical", characters: "口", position: 3 }),
      subject({
        id: 4,
        type: "kanji",
        characters: "上",
        componentIds: [1, 2],
        readings: [{ text: "じょう", kind: "onyomi", primary: true }],
        readingMnemonic: "joker",
      }),
      subject({
        id: 5,
        type: "vocab",
        characters: "上",
        componentIds: [4],
        readings: [{ text: "うえ", primary: true }],
        readingMnemonic: "うえ",
      }),
    ] as BundleSubject[],
  },
};

type Answerable = {
  id: number;
  type: BundleSubject["type"];
  meanings: Meaning[];
  readings: Reading[];
};

// Answers every question correctly, the way a learner would type it, and collects completions.
function answerAll(items: Answerable[]): CompletedItem[] {
  const byId = new Map(items.map((s) => [s.id, s]));
  const queueItems: QueueItem[] = items.map((s) => ({
    subjectId: s.id,
    questions: questionsFor(s.type),
  }));
  let state = createQueue(queueItems, Math.random);
  const completed: CompletedItem[] = [];
  for (let q = currentQuestion(state); q; q = currentQuestion(state)) {
    const s = byId.get(q.subjectId)!;
    const checked =
      q.kind === "meaning"
        ? checkMeaning(s.meanings[0].text.toUpperCase(), s, [], new Set())
        : checkReading(s.readings.find((r) => r.primary)!.text, s);
    const result = answerCurrent(state, checked.result === "correct");
    state = result.state;
    if (result.completed) completed.push(result.completed);
  }
  return completed;
}

let db: TestDb;
beforeEach(async () => {
  db = createTestDb();
  await runStartup(db, USER, fixture, START);
});

// Runs a review session over everything due at `at` with every answer right, and saves each
// finished item the way the review screen does.
async function reviewEverythingDue(at: Date) {
  const session = await loadReviewSession(db, USER, at);
  const results = [];
  for (const done of answerAll(session.map((i) => i.subject))) {
    results.push(await submitReview(db, USER, done, at, randomUUID));
  }
  return results;
}

describe("core study loop (spec 0004 AC-14)", () => {
  it("learns level 1 radicals, reviews them 4 hours later, and reaches stage 2", async () => {
    expect(await getHomeCounts(db, USER, START)).toEqual({ lessons: 3, reviews: 0 });

    // Lesson batch: the three radicals (the kanji is still locked behind them).
    const batch = await loadLessonBatch(db, USER);
    expect(batch.map((i) => i.subject.id)).toEqual([1, 2, 3]);
    for (const done of answerAll(batch.map((i) => i.subject))) {
      expect(await completeLessonItem(db, USER, done.subjectId, START)).toEqual({ ok: true });
    }
    expect(await getReviews(db, USER)).toEqual([]);
    expect(await getHomeCounts(db, USER, START)).toEqual({ lessons: 0, reviews: 0 });

    // Not due yet just before the first review time (4 hours, rounded down to the hour).
    const firstReview = new Date(Math.floor((START.getTime() + 4 * HOUR) / HOUR) * HOUR);
    expect(await loadReviewSession(db, USER, new Date(firstReview.getTime() - 1))).toEqual([]);

    const later = new Date(START.getTime() + 4 * HOUR);
    const session = await loadReviewSession(db, USER, later);
    expect(session).toHaveLength(3);
    expect(await getHomeCounts(db, USER, later)).toEqual({ lessons: 0, reviews: 3 });

    for (const done of answerAll(session.map((i) => i.subject))) {
      const result = await submitReview(db, USER, done, later, randomUUID);
      expect(result).toEqual({
        ok: true,
        startingStage: 1,
        newStage: 2,
        unlocked: 0,
        newLevel: null,
      });
    }

    const assignments = await getAssignments(db, USER);
    expect(assignments.map((a) => [a.subjectId, a.srsStage])).toEqual([
      [1, 2],
      [2, 2],
      [3, 2],
    ]);
    const reviews = await getReviews(db, USER);
    expect(reviews.map((r) => r.subjectId).sort()).toEqual([1, 2, 3]);
    expect(reviews.every((r) => r.startingStage === 1 && r.endingStage === 2)).toBe(true);
    expect(await getHomeCounts(db, USER, later)).toEqual({ lessons: 0, reviews: 0 });
    // The stage 2 interval is 8 hours.
    expect((await getHomeCounts(db, USER, new Date(later.getTime() + 8 * HOUR))).reviews).toBe(3);
  });

  it("reviews the radicals up to stage 5, which puts their kanji in the lesson queue (spec 0006 AC-1, AC-4)", async () => {
    for (const item of await loadLessonBatch(db, USER)) {
      await completeLessonItem(db, USER, item.subject.id, START);
    }
    // Stages 1, 2, 3, and 4 wait 4 hours, 8 hours, 1 day, and 2 days.
    let at = START;
    for (const wait of [4 * HOUR, 8 * HOUR, 24 * HOUR]) {
      at = new Date(at.getTime() + wait);
      const results = await reviewEverythingDue(at);
      expect(results.map((r) => r.ok && r.unlocked)).toEqual([0, 0, 0]);
    }
    expect(await getHomeCounts(db, USER, at)).toEqual({ lessons: 0, reviews: 0 });

    at = new Date(at.getTime() + 48 * HOUR);
    const results = await reviewEverythingDue(at);

    // The review that passed the second of the kanji's radicals (一 and 卜) unlocked it.
    expect(results.map((r) => r.ok && r.newStage)).toEqual([5, 5, 5]);
    expect(results.reduce((n, r) => n + (r.ok ? r.unlocked : 0), 0)).toBe(1);
    expect((await loadLessonBatch(db, USER)).map((i) => i.subject.id)).toEqual([4]);
    expect(await getAssignments(db, USER, [4])).toEqual([
      expect.objectContaining({ srsStage: 0, unlockedAt: at.getTime(), startedAt: null }),
    ]);
    // The word waits for its kanji.
    expect(await getAssignments(db, USER, [5])).toEqual([]);
  });

  it("gives lesson pages their mnemonics and component meanings", async () => {
    await updateAssignment(db, USER, 1, { srsStage: 5 });
    await updateAssignment(db, USER, 2, { srsStage: 5 });
    await updateAssignment(db, USER, 3, { srsStage: 5 });
    await insertAssignmentsIfMissing(db, USER, [{ subjectId: 4, srsStage: 0, unlockedAt: 0 }]);
    const [item] = await loadLessonBatch(db, USER);
    expect(item.subject).toMatchObject({ id: 4, meaningMnemonic: "mnemonic 4" });
    expect(item.components.map((c) => c.characters)).toEqual(["一", "卜"]);
  });
});

describe("answers loaded with a session (spec 0007 AC-3, AC-12)", () => {
  it("attaches your synonyms to lesson and review items, and [] without a notes row", async () => {
    await upsertNote(db, USER, 1, { synonyms: [" line ", ""] }, 0);
    const batch = await loadLessonBatch(db, USER);
    expect(batch.map((i) => [i.subject.id, i.synonyms])).toEqual([
      [1, ["line"]],
      [2, []],
      [3, []],
    ]);
    for (const done of answerAll(batch.map((i) => i.subject))) {
      await completeLessonItem(db, USER, done.subjectId, START);
    }
    const session = await loadReviewSession(db, USER, new Date(START.getTime() + 4 * HOUR));
    expect(session.find((i) => i.subject.id === 1)?.synonyms).toEqual(["line"]);
    expect(session.find((i) => i.subject.id === 2)?.synonyms).toEqual([]);
  });

  it("loads every subject's meaning forms as the course word set", async () => {
    const forms = await loadCourseForms(db);
    expect([...forms].sort()).toEqual([1, 2, 3, 4, 5].map((id) => `meaning ${id}`));
  });
});

describe("service errors (spec 0004 AC-9)", () => {
  it("completeLessonItem returns not_pending and writes nothing when the item is not at stage 0", async () => {
    await completeLessonItem(db, USER, 1, START);
    const before = await getAssignments(db, USER);
    expect(await completeLessonItem(db, USER, 1, START)).toEqual({
      ok: false,
      error: "not_pending",
    });
    expect(await completeLessonItem(db, USER, 99, START)).toEqual({
      ok: false,
      error: "not_pending",
    });
    expect(await getAssignments(db, USER)).toEqual(before);
  });

  it("submitReview returns not_due and leaves assignments and reviews unchanged", async () => {
    await completeLessonItem(db, USER, 1, START);
    const before = await getAssignments(db, USER);
    const input = { subjectId: 1, wrongMeaning: 0, wrongReading: 0 };
    // Stage 1, but 4 hours have not passed.
    expect(await submitReview(db, USER, input, START, randomUUID)).toEqual({
      ok: false,
      error: "not_due",
    });
    // Stage 0 (lesson not done) is never due.
    expect(await submitReview(db, USER, { ...input, subjectId: 2 }, START, randomUUID)).toEqual({
      ok: false,
      error: "not_due",
    });
    expect(await getAssignments(db, USER)).toEqual(before);
    expect(await getReviews(db, USER)).toEqual([]);
  });

  it("submitReview returns not_found for a subject with no assignment", async () => {
    const input = { subjectId: 4, wrongMeaning: 0, wrongReading: 0 };
    expect(await submitReview(db, USER, input, START, randomUUID)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await getReviews(db, USER)).toEqual([]);
  });

  it("a wrong answer in a review lowers nothing below stage 1 and records the counts", async () => {
    await completeLessonItem(db, USER, 1, START);
    const later = new Date(START.getTime() + 4 * HOUR);
    const result = await submitReview(
      db,
      USER,
      { subjectId: 1, wrongMeaning: 2, wrongReading: 0 },
      later,
      () => "review-1",
    );
    expect(result).toEqual({
      ok: true,
      startingStage: 1,
      newStage: 1,
      unlocked: 0,
      newLevel: null,
    });
    expect(await getReviews(db, USER)).toEqual([
      expect.objectContaining({ id: "review-1", incorrectMeaningCount: 2, endingStage: 1 }),
    ]);
  });
});
