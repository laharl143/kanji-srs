import { beforeEach, describe, expect, it } from "vitest";

import { subject } from "../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../tests/unit/db/harness";
import { insertAssignmentsIfMissing } from "@/lib/db/queries/assignments";
import { getOrCreateSettings, updateSettings } from "@/lib/db/queries/settings";
import { upsertSubjects } from "@/lib/db/queries/subjects";

import { getDashboard } from "./dashboard";
import { getLevelPage, getLevelsOverview } from "./levels";

const USER = "local";
const AT = new Date("2026-11-08T10:00:00Z").getTime();
let db: TestDb;

// Level 1: radicals 2, 1 (in that order); kanji 11, 12, 13; vocab 31. Level 2: kanji 21.
// Level 3: radical 41 only.
beforeEach(async () => {
  db = createTestDb();
  await upsertSubjects(db, [
    subject({ id: 2, type: "radical", level: 1, position: 1 }),
    subject({ id: 1, type: "radical", level: 1, position: 2 }),
    subject({ id: 11, type: "kanji", level: 1, position: 3 }),
    subject({ id: 12, type: "kanji", level: 1, position: 4 }),
    subject({ id: 13, type: "kanji", level: 1, position: 5 }),
    subject({ id: 31, type: "vocab", level: 1, position: 6 }),
    subject({ id: 21, type: "kanji", level: 2, position: 1 }),
    subject({ id: 41, type: "radical", level: 3, position: 1 }),
  ]);
  await getOrCreateSettings(db, USER, AT);
});

const row = (subjectId: number, srsStage: number) => ({
  subjectId,
  srsStage,
  unlockedAt: 0,
  availableAt: srsStage >= 1 && srsStage <= 8 ? AT + 1 : null,
});

describe("getLevelsOverview", () => {
  it("lists every level with content, kanji passed and total, and Home's stage counts", async () => {
    await insertAssignmentsIfMissing(db, USER, [
      row(1, 9),
      row(2, 0),
      row(11, 5),
      row(12, 8),
      row(13, 2),
      row(31, 6),
      row(21, 0),
    ]);
    await updateSettings(db, USER, { currentLevel: 2 });
    const o = await getLevelsOverview(db, USER, AT);
    expect(o.currentLevel).toBe(2);
    expect(o.levels).toEqual([
      { level: 1, kanjiPassed: 2, kanjiTotal: 3 },
      { level: 2, kanjiPassed: 0, kanjiTotal: 1 },
      { level: 3, kanjiPassed: 0, kanjiTotal: 0 },
    ]);
    // Stage 0 items are in no tile.
    expect(o.stages).toEqual({ seed: 1, sprout: 2, bloom: 0, harvest: 1, retired: 1 });
    expect(o.stages).toEqual((await getDashboard(db, USER, new Date(AT))).stages);
  });
});

describe("getLevelPage", () => {
  it("returns three sections in content order with stages and passed counts", async () => {
    await insertAssignmentsIfMissing(db, USER, [row(1, 5), row(11, 0), row(12, 7)]);
    const page = await getLevelPage(db, USER, 1);
    expect(page?.level).toBe(1);
    expect(
      page?.sections.map((s) => ({
        type: s.type,
        passed: s.passed,
        total: s.total,
        items: s.items.map((i) => [i.id, i.stage]),
      })),
    ).toEqual([
      {
        type: "radical",
        passed: 1,
        total: 2,
        items: [
          [2, null],
          [1, 5],
        ],
      },
      {
        type: "kanji",
        passed: 1,
        total: 3,
        items: [
          [11, 0],
          [12, 7],
          [13, null],
        ],
      },
      { type: "vocab", passed: 0, total: 1, items: [[31, null]] },
    ]);
  });

  it("keeps empty sections and returns null for a level with no subjects", async () => {
    const page = await getLevelPage(db, USER, 3);
    expect(page?.sections.map((s) => s.total)).toEqual([1, 0, 0]);
    expect(await getLevelPage(db, USER, 9)).toBeNull();
  });
});
