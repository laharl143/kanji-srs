import { promoteLevelForTesting } from "@/lib/db/queries/assignments";
import { getSettings } from "@/lib/db/queries/settings";
import { withTransaction } from "@/lib/db/transaction";
import type { Db } from "@/lib/db/types";

// Development tools behind `/dev/clock`, which only development and e2e builds can open
// (CLOCK_DEBUG_ENABLED). Nothing else calls these.

async function settingsOf(db: Db, userId: string) {
  const settings = await getSettings(db, userId);
  if (!settings) throw new Error("No user settings: startup has not run");
  return settings;
}

// Your current level, for the shortcut's button label.
export async function getCurrentLevel(db: Db, userId: string): Promise<number> {
  return (await settingsOf(db, userId)).currentLevel;
}

/**
 * The progress shortcut (spec 0006 AC-11): every item at your current level with stage 0 to 4
 * moves to stage 4, due now, so reviewing it right crosses stage 5 for real. One session of
 * radicals then unlocks their kanji, and one session of kanji opens the next level. Writes no
 * review history. Throws on a DB failure.
 */
export async function promoteCurrentLevel(
  db: Db,
  userId: string,
  now: Date,
): Promise<{ level: number; moved: number }> {
  return withTransaction(db, async (tx) => {
    const level = (await settingsOf(tx, userId)).currentLevel;
    const moved = await promoteLevelForTesting(tx, userId, level, now.getTime());
    return { level, moved };
  });
}
