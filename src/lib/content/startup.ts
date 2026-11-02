import { insertAssignmentsIfMissing } from "@/lib/db/queries/assignments";
import { getMeta, setMeta } from "@/lib/db/queries/meta";
import { getOrCreateSettings, getSettings } from "@/lib/db/queries/settings";
import { getInitialUnlockIds, upsertSubjects } from "@/lib/db/queries/subjects";
import { withTransaction } from "@/lib/db/transaction";
import type { Db } from "@/lib/db/types";

import type { BundledContent } from "./types";

export const CONTENT_VERSION_KEY = "content_version";

/**
 * Launch reseed (0001 §5.6, spec 0004 AC-5). When the bundled version differs from the stored
 * one, or on first launch, upserts every bundled subject and writes the version in one
 * transaction. On first launch it also creates the settings and unlocks the starting set at
 * stage 0. Never deletes a subject and never touches existing progress. Throws on a DB failure.
 */
export async function runStartup(
  db: Db,
  userId: string,
  content: BundledContent,
  now: Date,
): Promise<{ reseeded: boolean }> {
  // Both checks happen before any write.
  const firstLaunch = (await getSettings(db, userId)) === undefined;
  const stored = await getMeta(db, CONTENT_VERSION_KEY);
  if (!firstLaunch && stored === content.version) return { reseeded: false };

  const at = now.getTime();
  await withTransaction(db, async (tx) => {
    await upsertSubjects(tx, content.bundle.subjects);
    if (firstLaunch) {
      await getOrCreateSettings(tx, userId, at);
      const ids = await getInitialUnlockIds(tx);
      await insertAssignmentsIfMissing(
        tx,
        userId,
        ids.map((subjectId) => ({ subjectId, srsStage: 0, unlockedAt: at })),
      );
    }
    await setMeta(tx, CONTENT_VERSION_KEY, content.version);
  });
  return { reseeded: true };
}
