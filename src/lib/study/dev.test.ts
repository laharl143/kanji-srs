import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

import shippedBundle from "../../../content/bundle.json";
import { createTestDb, type TestDb } from "../../../tests/unit/db/harness";
import { runStartup } from "@/lib/content/startup";
import type { Bundle, BundledContent } from "@/lib/content/types";
import { getAssignments } from "@/lib/db/queries/assignments";
import { getReviews } from "@/lib/db/queries/reviews";
import { getSettings } from "@/lib/db/queries/settings";
import { userSettings } from "@/lib/db/schema";

import { getCurrentLevel, promoteCurrentLevel } from "./dev";
import { getHomeCounts } from "./home";
import { loadReviewSession, submitReview, type ReviewResult } from "./reviews";

const USER = "local";
const START = new Date("2026-11-07T09:00:00Z");
const HOUR = 3_600_000;

const shipped: BundledContent = {
  bundle: shippedBundle as Bundle,
  version: readFileSync(
    new URL("../../../content/content-version.txt", import.meta.url),
    "utf8",
  ).trim(),
};
const level1 = (type: string) =>
  shipped.bundle.subjects.filter((s) => s.level === 1 && s.type === type);

let db: TestDb;
beforeEach(async () => {
  db = createTestDb();
  await runStartup(db, USER, shipped, START);
});

// One review session over everything due at `at`, every answer right, in load order.
async function reviewAllDue(at: Date): Promise<ReviewResult[]> {
  const results: ReviewResult[] = [];
  for (const item of await loadReviewSession(db, USER, at)) {
    const input = { subjectId: item.subject.id, wrongMeaning: 0, wrongReading: 0 };
    const result = await submitReview(db, USER, input, at, randomUUID);
    if (!result.ok) throw new Error(`review not saved: ${result.error}`);
    results.push(result);
  }
  return results;
}

describe("promoteCurrentLevel (spec 0006 AC-11)", () => {
  it("one session of level 1 radicals unlocks the level 1 kanji, and one of kanji opens level 2", async () => {
    const radicals = level1("radical");
    const kanji = level1("kanji");
    expect(await getCurrentLevel(db, USER)).toBe(1);

    // The first launch's radical lessons go straight to stage 4, due now, with no review rows.
    expect(await promoteCurrentLevel(db, USER, START)).toEqual({
      level: 1,
      moved: radicals.length,
    });
    expect(await getReviews(db, USER)).toEqual([]);
    expect(await getHomeCounts(db, USER, START)).toEqual({ lessons: 0, reviews: radicals.length });

    const radicalSession = await reviewAllDue(START);
    expect(radicalSession.every((r) => r.startingStage === 4 && r.newStage === 5)).toBe(true);
    expect(radicalSession.reduce((n, r) => n + r.unlocked, 0)).toBe(kanji.length);
    expect((await getHomeCounts(db, USER, START)).lessons).toBe(kanji.length);

    // The kanji lessons, moved the same way an hour later.
    const later = new Date(START.getTime() + HOUR);
    expect(await promoteCurrentLevel(db, USER, later)).toEqual({ level: 1, moved: kanji.length });
    const kanjiSession = await reviewAllDue(later);

    // The review that passed 90% of the level's kanji opened level 2, once.
    const needed = Math.ceil(kanji.length * 0.9);
    expect(kanjiSession.findIndex((r) => r.newLevel !== null)).toBe(needed - 1);
    expect(kanjiSession.filter((r) => r.newLevel !== null).map((r) => r.newLevel)).toEqual([2]);
    expect((await getSettings(db, USER))?.currentLevel).toBe(2);
    expect(await getCurrentLevel(db, USER)).toBe(2);
    // Every review row came from a real review: the radicals, then the kanji.
    expect(await getReviews(db, USER)).toHaveLength(radicals.length + kanji.length);
  });

  it("leaves passed items alone on a second run", async () => {
    await promoteCurrentLevel(db, USER, START);
    await reviewAllDue(START);
    const passed = await getAssignments(db, USER);

    // The radicals are at stage 5 now; only the newly unlocked kanji move.
    const later = new Date(START.getTime() + HOUR);
    const { moved } = await promoteCurrentLevel(db, USER, later);
    expect(moved).toBe(level1("kanji").length);
    const radicalIds = new Set(level1("radical").map((s) => s.id));
    const radicalsNow = (await getAssignments(db, USER)).filter((a) => radicalIds.has(a.subjectId));
    expect(radicalsNow).toEqual(passed.filter((a) => radicalIds.has(a.subjectId)));
  });

  it("throws when the settings row is missing", async () => {
    await db.delete(userSettings);
    await expect(promoteCurrentLevel(db, USER, START)).rejects.toThrow("No user settings");
    await expect(getCurrentLevel(db, USER)).rejects.toThrow("No user settings");
  });
});
