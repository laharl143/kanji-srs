import { describe, expect, it } from "vitest";

import shippedBundle from "../../../content/bundle.json";
import type { Bundle } from "@/lib/content/types";

import {
  checkLevelUp,
  kanjiToLevelUp,
  computeUnlocks,
  planProgression,
  type ProgressionAssignment,
  type ProgressionSubject,
} from "./progression";

const NOW = new Date("2026-11-07T09:00:00Z");
const AT = NOW.getTime();

const radical = (id: number, level = 1): ProgressionSubject => ({
  id,
  type: "radical",
  level,
  componentIds: [],
});
const kanji = (id: number, level: number, componentIds: number[] = []): ProgressionSubject => ({
  id,
  type: "kanji",
  level,
  componentIds,
});
const vocab = (id: number, level: number, componentIds: number[]): ProgressionSubject => ({
  id,
  type: "vocab",
  level,
  componentIds,
});
const at = (stage: number, ...ids: number[]): ProgressionAssignment[] =>
  ids.map((subjectId) => ({ subjectId, srsStage: stage }));
const ids = (rows: { subjectId: number }[]) => rows.map((r) => r.subjectId);

// n kanji at `level`, ids from `first`, the first `passed` of them at stage 5.
function kanjiLevel(level: number, first: number, n: number, passed: number) {
  const subjects = Array.from({ length: n }, (_, i) => kanji(first + i, level));
  const assignments = subjects.map((s, i) => ({ subjectId: s.id, srsStage: i < passed ? 5 : 4 }));
  return { subjects, assignments };
}

describe("computeUnlocks (spec 0006 AC-1)", () => {
  const subjects = [radical(1), radical(2), kanji(3, 1, [1, 2]), vocab(4, 1, [3])];

  it("keeps a kanji locked until every one of its radicals is passed", () => {
    expect(computeUnlocks(subjects, [...at(5, 1), ...at(4, 2)], 1, NOW)).toEqual([]);
    expect(computeUnlocks(subjects, [...at(5, 1), ...at(5, 2)], 1, NOW)).toEqual([
      { subjectId: 3, srsStage: 0, unlockedAt: AT },
    ]);
  });

  it("counts stage 5 and above as passed, including retired", () => {
    expect(ids(computeUnlocks(subjects, [...at(9, 1), ...at(6, 2)], 1, NOW))).toEqual([3]);
  });

  it("treats a component with no assignment, or with no subject row, as not passed", () => {
    // Radical 2 has no assignment.
    expect(computeUnlocks(subjects, at(5, 1), 1, NOW)).toEqual([radical(2)].map(unlockOf));
    // Subject 99 is a component with an assignment at stage 5 but no subject row.
    const orphan = [radical(1), kanji(5, 1, [1, 99])];
    expect(computeUnlocks(orphan, at(5, 1, 99), 1, NOW)).toEqual([]);
  });

  it("never returns a subject above the current level or one that already has a row", () => {
    const withLevel2 = [...subjects, radical(10, 2), kanji(11, 2, [1])];
    const assigned = [...at(5, 1, 2), ...at(0, 3)];
    expect(ids(computeUnlocks(withLevel2, assigned, 1, NOW))).toEqual([]);
    expect(ids(computeUnlocks(withLevel2, assigned, 2, NOW))).toEqual([10, 11]);
  });

  it("unlocks every radical once its level is reached, and a word once its kanji are passed", () => {
    expect(ids(computeUnlocks(subjects, [], 1, NOW))).toEqual([1, 2]);
    expect(ids(computeUnlocks(subjects, at(5, 1, 2, 3), 1, NOW))).toEqual([4]);
  });

  it("returns rows sorted by subject id", () => {
    const shuffled = [radical(7), radical(2), radical(5)];
    expect(ids(computeUnlocks(shuffled, [], 1, NOW))).toEqual([2, 5, 7]);
  });
});

function unlockOf(s: ProgressionSubject) {
  return { subjectId: s.id, srsStage: 0, unlockedAt: AT };
}

describe("checkLevelUp (spec 0006 AC-2)", () => {
  // A level 2 radical so level 1 is never the highest level.
  const above = [radical(500, 2)];

  it("levels up at 90% of the level's kanji: 23 of 25 yes, 22 of 25 no, 9 of 10 yes", () => {
    const yes = kanjiLevel(1, 1, 25, 23);
    expect(checkLevelUp([...yes.subjects, ...above], yes.assignments, 1)).toBe(2);
    const no = kanjiLevel(1, 1, 25, 22);
    expect(checkLevelUp([...no.subjects, ...above], no.assignments, 1)).toBeNull();
    const ten = kanjiLevel(1, 1, 10, 9);
    expect(checkLevelUp([...ten.subjects, ...above], ten.assignments, 1)).toBe(2);
  });

  it("passes a level with no kanji at once", () => {
    expect(checkLevelUp([radical(1), ...above], [], 1)).toBe(2);
  });

  it("never levels up past the highest level", () => {
    const top = kanjiLevel(2, 1, 10, 10);
    expect(checkLevelUp(top.subjects, top.assignments, 2)).toBeNull();
    // Content shrank below your level: nothing happens either.
    expect(checkLevelUp(top.subjects, top.assignments, 3)).toBeNull();
    expect(checkLevelUp([], [], 1)).toBeNull();
  });

  it("counts only kanji at the current level, by their stage right now", () => {
    // Kanji 1 to 10 at level 1, with 1 to 8 passed.
    const level1 = kanjiLevel(1, 1, 10, 8);
    const subjects = [...level1.subjects, radical(20), vocab(21, 1, [1]), kanji(22, 2), ...above];
    // Passed radicals, words, and next level kanji do not count toward level 1.
    const others = at(9, 20, 21, 22);
    expect(checkLevelUp(subjects, [...level1.assignments, ...others], 1)).toBeNull();
    // Kanji 9 at stage 5 makes 9 of 10; back at stage 4 it holds the level up back again.
    const nine = [...at(5, 1, 2, 3, 4, 5, 6, 7, 8, 9), ...at(4, 10), ...others];
    expect(checkLevelUp(subjects, nine, 1)).toBe(2);
    const dropped = [...at(5, 1, 2, 3, 4, 5, 6, 7, 8), ...at(4, 9, 10), ...others];
    expect(checkLevelUp(subjects, dropped, 1)).toBeNull();
  });
});

describe("planProgression (spec 0006 AC-3)", () => {
  it("levels up and unlocks the new level's radicals and the kanji whose radicals passed", () => {
    const subjects = [
      radical(1),
      radical(2),
      kanji(3, 1, [1]),
      kanji(4, 1, [2]),
      vocab(5, 1, [3, 4]),
      radical(10, 2),
      kanji(11, 2, [1, 2]),
      kanji(12, 2, [10]),
      vocab(13, 2, [3]),
      radical(20, 3),
      kanji(21, 3, [1]),
    ];
    const plan = planProgression({
      subjects,
      assignments: at(5, 1, 2, 3, 4),
      currentLevel: 1,
      now: NOW,
    });
    expect(plan.level).toBe(2);
    // Word 5 (level 1, its kanji just passed) and word 13 (level 2, built on a level 1 kanji)
    // unlock in the same run; kanji 12 waits on radical 10; nothing comes from level 3.
    expect(plan.unlocks).toEqual([5, 10, 11, 13].map((subjectId) => unlockOfId(subjectId)));
  });

  it("stays at the current level and still returns its unlocks when there is no level up", () => {
    const subjects = [radical(1), kanji(2, 1, [1]), radical(3, 2)];
    expect(planProgression({ subjects, assignments: [], currentLevel: 1, now: NOW })).toEqual({
      level: 1,
      unlocks: [unlockOfId(1)],
    });
  });

  it("climbs through a run of kanji free levels and stops at the highest level", () => {
    const subjects = [kanji(1, 1), radical(2, 2), radical(3, 3), radical(4, 4)];
    const plan = planProgression({ subjects, assignments: at(5, 1), currentLevel: 1, now: NOW });
    expect(plan.level).toBe(4);
    expect(ids(plan.unlocks)).toEqual([2, 3, 4]);
  });

  it("changes nothing when run again on its own result", () => {
    const subjects = [radical(1), kanji(2, 1, [1]), radical(3, 2)];
    const first = planProgression({ subjects, assignments: at(5, 1), currentLevel: 1, now: NOW });
    const assignments = [...at(5, 1), ...first.unlocks];
    const again = planProgression({ subjects, assignments, currentLevel: first.level, now: NOW });
    expect(again).toEqual({ level: first.level, unlocks: [] });
  });

  it("on the shipped content, reaching level 2 unlocks its 23 radicals and 下, 山, 午, 先", () => {
    const subjects = (shippedBundle as Bundle).subjects;
    // Every level 1 radical and kanji passed: level 1 is complete.
    const level1 = subjects.filter((s) => s.level === 1 && s.type !== "vocab");
    const plan = planProgression({
      subjects,
      assignments: level1.map((s) => ({ subjectId: s.id, srsStage: 5 })),
      currentLevel: 1,
      now: NOW,
    });

    expect(plan.level).toBe(2);
    const byId = new Map(subjects.map((s) => [s.id, s]));
    const unlocked = plan.unlocks.map((u) => byId.get(u.subjectId)!);
    const level2 = unlocked.filter((s) => s.level === 2);
    const of = (type: string) => level2.filter((s) => s.type === type);
    const allLevel2Radicals = subjects.filter((s) => s.level === 2 && s.type === "radical");
    expect(allLevel2Radicals).toHaveLength(23);
    expect(of("radical")).toHaveLength(23);
    expect(
      of("kanji")
        .map((s) => s.characters)
        .sort(),
    ).toEqual(["下", "山", "午", "先"].sort());
    expect(of("vocab")).toEqual([]);
    // Everything else is a level 1 word whose kanji just passed; nothing comes from level 3.
    const rest = unlocked.filter((s) => s.level !== 2);
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.every((s) => s.level === 1 && s.type === "vocab")).toBe(true);
  });
});

function unlockOfId(subjectId: number) {
  return { subjectId, srsStage: 0, unlockedAt: AT };
}

describe("kanjiToLevelUp", () => {
  it("matches checkLevelUp at the 90% boundary", () => {
    expect(kanjiToLevelUp(17, 20, false)).toBe(1);
    expect(kanjiToLevelUp(18, 20, false)).toBe(0);
    expect(kanjiToLevelUp(20, 20, false)).toBe(0);
    // 9 of 11: ceil(9.9) = 10 needed, and checkLevelUp agrees 9 is not enough.
    expect(kanjiToLevelUp(9, 11, false)).toBe(1);
    expect(kanjiToLevelUp(0, 0, false)).toBe(0);
  });

  it("agrees with checkLevelUp for every passed count", () => {
    const total = 13;
    const subjects = Array.from({ length: total }, (_, i) => kanji(i + 1, 1));
    const withNext = [...subjects, radical(100, 2)];
    for (let passed = 0; passed <= total; passed++) {
      const assignments = at(5, ...subjects.slice(0, passed).map((s) => s.id));
      const levelsUp = checkLevelUp(withNext, assignments, 1) !== null;
      expect(kanjiToLevelUp(passed, total, false) === 0).toBe(levelsUp);
    }
  });

  it("is null at the highest level", () => {
    expect(kanjiToLevelUp(3, 20, true)).toBeNull();
  });
});
