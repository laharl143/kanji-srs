// SRS progression rules (spec 0006 AC-1 to AC-3): what unlocks, and when you level up.
// Pure: no DB, framework, or clock. The callers load the inputs and write the result, so one
// rule set serves reviews, launch, and later the skip ahead and reset tools (0010).
import type { SubjectType } from "@/lib/types";

import { PASSED_STAGE } from "./config";

export type ProgressionSubject = {
  id: number;
  type: SubjectType;
  level: number;
  componentIds: readonly number[];
};
export type ProgressionAssignment = { subjectId: number; srsStage: number };
export type UnlockRow = { subjectId: number; srsStage: 0; unlockedAt: number };

function stagesById(assignments: readonly ProgressionAssignment[]): Map<number, number> {
  return new Map(assignments.map((a) => [a.subjectId, a.srsStage]));
}

function isPassed(stage: number | undefined): boolean {
  return stage !== undefined && stage >= PASSED_STAGE;
}

/**
 * Subjects to unlock now (AC-1): no assignment yet, `level <= currentLevel`, and every component
 * passed (stage 5 or higher). A subject with no components (every radical) qualifies as soon as
 * its level is reached. A component with no assignment, or with no subject row, counts as not
 * passed. Sorted by subject id.
 */
export function computeUnlocks(
  subjects: readonly ProgressionSubject[],
  assignments: readonly ProgressionAssignment[],
  currentLevel: number,
  now: Date,
): UnlockRow[] {
  const stages = stagesById(assignments);
  const known = new Set(subjects.map((s) => s.id));
  const passed = (id: number) => known.has(id) && isPassed(stages.get(id));
  const unlockedAt = now.getTime();
  return subjects
    .filter((s) => !stages.has(s.id) && s.level <= currentLevel && s.componentIds.every(passed))
    .map((s): UnlockRow => ({ subjectId: s.id, srsStage: 0, unlockedAt }))
    .sort((a, b) => a.subjectId - b.subjectId);
}

/**
 * The next level if you level up now (AC-2), else null. You level up when at least 90% of the
 * kanji at `currentLevel` are passed right now (`passed * 10 >= total * 9`, so a level with no
 * kanji passes at once) and `currentLevel` is below the highest level in `subjects`.
 */
export function checkLevelUp(
  subjects: readonly ProgressionSubject[],
  assignments: readonly ProgressionAssignment[],
  currentLevel: number,
): number | null {
  let highest = -Infinity;
  for (const s of subjects) highest = Math.max(highest, s.level);
  if (currentLevel >= highest) return null;

  const stages = stagesById(assignments);
  let total = 0;
  let passed = 0;
  for (const s of subjects) {
    if (s.type !== "kanji" || s.level !== currentLevel) continue;
    total += 1;
    if (isPassed(stages.get(s.id))) passed += 1;
  }
  return passed * 10 >= total * 9 ? currentLevel + 1 : null;
}

/**
 * Levels up as far as the rules allow, then lists what unlocks at the level reached (AC-3). So a
 * level up unlocks the new level's radicals plus its kanji whose radicals are all passed, and
 * nothing above the new level. Running it again on its own result changes nothing.
 */
export function planProgression(input: {
  subjects: readonly ProgressionSubject[];
  assignments: readonly ProgressionAssignment[];
  currentLevel: number;
  now: Date;
}): { level: number; unlocks: UnlockRow[] } {
  const { subjects, assignments, now } = input;
  let level = input.currentLevel;
  let next = checkLevelUp(subjects, assignments, level);
  while (next !== null) {
    level = next;
    next = checkLevelUp(subjects, assignments, level);
  }
  return { level, unlocks: computeUnlocks(subjects, assignments, level, now) };
}

/**
 * How many more kanji at the current level must pass to level up (spec 0008 AC-3), from the same
 * rule as `checkLevelUp` (`passed * 10 >= total * 9`): `max(0, ceil(total * 0.9) - passed)`.
 * Null at the highest level, where there is no next level.
 */
export function kanjiToLevelUp(
  passed: number,
  total: number,
  atHighestLevel: boolean,
): number | null {
  if (atHighestLevel) return null;
  return Math.max(0, Math.ceil((total * 9) / 10) - passed);
}
