import {
  countDue,
  countLessons,
  getForecast,
  getLevelProgress,
  getStageCounts,
} from "@/lib/db/queries/assignments";
import { getOrCreateSettings } from "@/lib/db/queries/settings";
import { getLevelSummaries } from "@/lib/db/queries/subjects";
import type { Db } from "@/lib/db/types";
import { bucketForecast, FORECAST_WINDOW_MS, type ForecastRow } from "@/lib/srs/forecast";
import { kanjiToLevelUp } from "@/lib/srs/progression";
import type { SubjectType } from "@/lib/types";
import { stageGroup } from "@/theme/stage";

export type { ForecastRow };

export type DashboardStage = "seed" | "sprout" | "bloom" | "harvest" | "retired";
export const DASHBOARD_STAGES: readonly DashboardStage[] = [
  "seed",
  "sprout",
  "bloom",
  "harvest",
  "retired",
];

type Progress = { passed: number; total: number };

export type Dashboard = {
  lessons: number;
  reviews: number;
  forecast: ForecastRow[];
  level: {
    level: number;
    radicals: Progress;
    kanji: Progress;
    vocab: Progress;
    kanjiToLevelUp: number | null;
  };
  stages: Record<DashboardStage, number>;
};

/**
 * Everything Home shows (spec 0008 AC-5), from local queries only. `now` comes from the caller
 * (`now()` in `@/lib/clock`), so the debug clock moves the dashboard too.
 */
export async function getDashboard(db: Db, userId: string, now: Date): Promise<Dashboard> {
  const at = now.getTime();
  const lessons = await countLessons(db, userId);
  const reviews = await countDue(db, userId, at);
  // A review due exactly at `now` is already in `reviews`, so the window starts just after it.
  const times = await getForecast(db, userId, at + 1, at + FORECAST_WINDOW_MS);
  const forecast = bucketForecast(times, at, reviews);

  const { currentLevel } = await getOrCreateSettings(db, userId, at);
  const byType = new Map<SubjectType, Progress>();
  for (const row of await getLevelProgress(db, userId, currentLevel)) {
    byType.set(row.type, { passed: Number(row.passed), total: Number(row.total) });
  }
  const pick = (type: SubjectType): Progress => byType.get(type) ?? { passed: 0, total: 0 };
  const kanji = pick("kanji");
  let highest = -Infinity;
  for (const s of await getLevelSummaries(db, userId)) highest = Math.max(highest, s.level);

  const stages = await countStageGroups(db, userId);

  return {
    lessons,
    reviews,
    forecast,
    level: {
      level: currentLevel,
      radicals: pick("radical"),
      kanji,
      vocab: pick("vocab"),
      kanjiToLevelUp: kanjiToLevelUp(kanji.passed, kanji.total, currentLevel >= highest),
    },
    stages,
  };
}

/**
 * Your items per stage group (Seed to Retired), the one count Home and the Levels tab share
 * (spec 0008 AC-4, spec 0009 AC-8). Lesson (stage 0) and locked items are in no group.
 */
export async function countStageGroups(
  db: Db,
  userId: string,
): Promise<Record<DashboardStage, number>> {
  const stages: Record<DashboardStage, number> = {
    seed: 0,
    sprout: 0,
    bloom: 0,
    harvest: 0,
    retired: 0,
  };
  for (const { stage, count } of await getStageCounts(db, userId)) {
    const { group } = stageGroup(stage);
    if (group in stages) stages[group as DashboardStage] += count;
  }
  return stages;
}
