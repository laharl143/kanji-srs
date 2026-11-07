import { getAssignments, insertAssignmentsIfMissing } from "@/lib/db/queries/assignments";
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
 * After a reseed commits it logs progress rows whose subject left the bundle (spec 0005 AC-8).
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
  await warnOutsideBundle(db, userId, content);
  return { reseeded: true };
}

const ORPHAN_LOG_LIMIT = 20;

// A subject that drops out of the course keeps its row and its progress on the phone. Nothing
// changes here; the warning only makes it visible. A failure of this check never fails startup.
async function warnOutsideBundle(db: Db, userId: string, content: BundledContent) {
  try {
    const bundled = new Set(content.bundle.subjects.map((s) => s.id));
    const ids = (await getAssignments(db, userId))
      .map((a) => a.subjectId)
      .filter((id) => !bundled.has(id));
    if (ids.length > 0) {
      console.warn(
        `reseed: ${ids.length} assignments point at subjects not in the bundle: ${ids.slice(0, ORPHAN_LOG_LIMIT).join(", ")}`,
      );
    }
  } catch (error) {
    console.warn("reseed: could not check assignments against the bundle", error);
  }
}
