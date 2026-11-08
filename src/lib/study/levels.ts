import { getOrCreateSettings } from "@/lib/db/queries/settings";
import { PASSED_STAGE } from "@/lib/db/queries/shared";
import { getLevelTypeSummaries, getSubjectsByLevel } from "@/lib/db/queries/subjects";
import type { Db } from "@/lib/db/types";
import type { SubjectType } from "@/lib/types";

import { countStageGroups, type DashboardStage } from "./dashboard";
import { withStages, type Chip } from "./items";

export type LevelRow = { level: number; kanjiPassed: number; kanjiTotal: number };

export type LevelsOverview = {
  currentLevel: number;
  stages: Record<DashboardStage, number>;
  levels: LevelRow[];
};

/**
 * The Levels tab (spec 0009 AC-8): stage tiles from the same function as Home, then one row per
 * level that has content, with kanji passed and total (0 and 0 for a level with no kanji).
 */
export async function getLevelsOverview(
  db: Db,
  userId: string,
  now: number,
): Promise<LevelsOverview> {
  const { currentLevel } = await getOrCreateSettings(db, userId, now);
  const stages = await countStageGroups(db, userId);
  const byLevel = new Map<number, LevelRow>();
  for (const row of await getLevelTypeSummaries(db, userId)) {
    const entry = byLevel.get(row.level) ?? { level: row.level, kanjiPassed: 0, kanjiTotal: 0 };
    if (row.type === "kanji") {
      entry.kanjiPassed = row.passed;
      entry.kanjiTotal = row.total;
    }
    byLevel.set(row.level, entry);
  }
  const levels = [...byLevel.values()].sort((a, b) => a.level - b.level);
  return { currentLevel, stages, levels };
}

export type LevelSection = { type: SubjectType; passed: number; total: number; items: Chip[] };
export type LevelPage = { level: number; sections: LevelSection[] };

const SECTION_TYPES: readonly SubjectType[] = ["radical", "kanji", "vocab"];

/**
 * One level's items (spec 0009 AC-9): Radicals, Kanji, and Vocabulary in content order, each
 * with its stages and passed count (stage 5 or higher). `null` when the level has no subjects.
 */
export async function getLevelPage(
  db: Db,
  userId: string,
  level: number,
): Promise<LevelPage | null> {
  const subjects = await getSubjectsByLevel(db, level);
  if (subjects.length === 0) return null;
  const chips = await withStages(db, userId, subjects);
  const sections = SECTION_TYPES.map((type) => {
    const items = chips.filter((c) => c.type === type);
    const passed = items.filter((c) => c.stage !== null && c.stage >= PASSED_STAGE).length;
    return { type, passed, total: items.length, items };
  });
  return { level, sections };
}
