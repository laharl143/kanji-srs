import { countDue, countLessons } from "@/lib/db/queries/assignments";
import type { Db } from "@/lib/db/types";

// Home's two counts (spec 0004 AC-12): every stage 0 item, and reviews due as of `now`.
export async function getHomeCounts(
  db: Db,
  userId: string,
  now: Date,
): Promise<{ lessons: number; reviews: number }> {
  return {
    lessons: await countLessons(db, userId),
    reviews: await countDue(db, userId, now.getTime()),
  };
}
