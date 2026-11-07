import { getAssignments, insertAssignmentsIfMissing } from "@/lib/db/queries/assignments";
import { getSettings, updateSettings } from "@/lib/db/queries/settings";
import { getUnlockInputs } from "@/lib/db/queries/subjects";
import type { Db } from "@/lib/db/types";
import { planProgression } from "@/lib/srs/progression";

export type ProgressionResult = { unlocked: number; newLevel: number | null };

/**
 * Unlocks and level up (spec 0006 AC-4). Loads every subject, your assignments, and your level,
 * lets the pure planner in `@/lib/srs/progression` decide, then writes the result through the
 * caller's transaction: unlocks are inserted at stage 0 and never touch an existing row, and
 * `current_level` only rises. `newLevel` is null when the level did not change.
 *
 * Never opens its own transaction (a nested `withTransaction` throws). Throws on a DB failure or
 * a missing settings row, so the caller's whole transaction rolls back.
 */
export async function runProgression(
  tx: Db,
  userId: string,
  now: Date,
): Promise<ProgressionResult> {
  const settings = await getSettings(tx, userId);
  if (!settings) throw new Error("No user settings: startup has not run");
  const plan = planProgression({
    subjects: await getUnlockInputs(tx),
    assignments: await getAssignments(tx, userId),
    currentLevel: settings.currentLevel,
    now,
  });
  await insertAssignmentsIfMissing(tx, userId, plan.unlocks);
  const newLevel = plan.level > settings.currentLevel ? plan.level : null;
  if (newLevel !== null) await updateSettings(tx, userId, { currentLevel: newLevel });
  return { unlocked: plan.unlocks.length, newLevel };
}
