import { beforeEach, describe, expect, it } from "vitest";

import { subject } from "../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../tests/unit/db/harness";
import { insertAssignmentsIfMissing } from "@/lib/db/queries/assignments";
import { getOrCreateSettings, updateSettings } from "@/lib/db/queries/settings";
import { upsertSubjects } from "@/lib/db/queries/subjects";
import { HOUR_MS } from "@/lib/srs/config";
import { startOfLocalHour } from "@/lib/srs/forecast";

import { getDashboard } from "./dashboard";

const USER = "local";
const NOW = new Date("2026-11-08T10:15:00Z");
const AT = NOW.getTime();
let db: TestDb;

// Level 1: 2 radicals, 10 kanji (ids 11 to 20), 3 vocab. Level 2: 1 radical.
beforeEach(async () => {
  db = createTestDb();
  await upsertSubjects(db, [
    subject({ id: 1, type: "radical", level: 1 }),
    subject({ id: 2, type: "radical", level: 1 }),
    ...Array.from({ length: 10 }, (_, i) => subject({ id: 11 + i, type: "kanji", level: 1 })),
    subject({ id: 31, type: "vocab", level: 1 }),
    subject({ id: 32, type: "vocab", level: 1 }),
    subject({ id: 33, type: "vocab", level: 1 }),
    subject({ id: 41, type: "radical", level: 2 }),
  ]);
  await getOrCreateSettings(db, USER, AT);
});

const row = (subjectId: number, srsStage: number, availableAt: number | null = null) => ({
  subjectId,
  srsStage,
  unlockedAt: 0,
  availableAt,
});

describe("getDashboard", () => {
  it("returns counts, forecast, level progress, and stage groups for a seeded user", async () => {
    await insertAssignmentsIfMissing(db, USER, [
      row(1, 5, AT + 100 * HOUR_MS), // passed radical, far future
      row(2, 9), // retired radical
      // 8 of 10 kanji passed: 7 at stage 5, 1 at stage 7
      ...[11, 12, 13, 14, 15, 16, 17].map((id) => row(id, 5, AT + 200 * HOUR_MS)),
      row(18, 7, AT + 300 * HOUR_MS),
      row(19, 2, AT), // due exactly now: counted once, in reviews
      row(20, 1, AT - HOUR_MS), // due an hour ago
      row(31, 3, AT + HOUR_MS + 1), // forecast
      row(32, 4, AT + HOUR_MS + 5 * 60_000), // forecast, same hour as 31
      row(33, 8, AT + 24 * HOUR_MS), // exactly 24 hours out: outside the window
      row(41, 0), // lesson
    ]);

    const d = await getDashboard(db, USER, NOW);

    expect(d.lessons).toBe(1);
    expect(d.reviews).toBe(2);
    expect(d.forecast).toEqual([
      { hourStart: startOfLocalHour(AT + HOUR_MS + 1), count: 2, runningTotal: 4 },
    ]);
    expect(d.level).toEqual({
      level: 1,
      radicals: { passed: 2, total: 2 },
      kanji: { passed: 8, total: 10 },
      vocab: { passed: 1, total: 3 },
      kanjiToLevelUp: 1,
    });
    // Stage 0 (lesson) is left out.
    expect(d.stages).toEqual({ seed: 4, sprout: 8, bloom: 1, harvest: 1, retired: 1 });
  });

  it("shows zeros for a new user and every stage group still appears", async () => {
    const d = await getDashboard(db, USER, NOW);
    expect(d.lessons).toBe(0);
    expect(d.reviews).toBe(0);
    expect(d.forecast).toEqual([]);
    expect(d.level.kanji).toEqual({ passed: 0, total: 10 });
    expect(d.level.kanjiToLevelUp).toBe(9);
    expect(d.stages).toEqual({ seed: 0, sprout: 0, bloom: 0, harvest: 0, retired: 0 });
  });

  it("hides the level up count at the highest level", async () => {
    await updateSettings(db, USER, { currentLevel: 2 });
    const d = await getDashboard(db, USER, NOW);
    expect(d.level.level).toBe(2);
    expect(d.level.radicals).toEqual({ passed: 0, total: 1 });
    expect(d.level.kanji).toEqual({ passed: 0, total: 0 });
    expect(d.level.kanjiToLevelUp).toBeNull();
  });

  it("counts only this user's rows", async () => {
    await insertAssignmentsIfMissing(db, "someone-else", [row(11, 5), row(12, 1, AT)]);
    const d = await getDashboard(db, USER, NOW);
    expect(d.reviews).toBe(0);
    expect(d.level.kanji.passed).toBe(0);
    expect(d.stages.sprout).toBe(0);
  });
});
