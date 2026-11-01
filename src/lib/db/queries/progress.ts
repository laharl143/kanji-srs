import { eq } from "drizzle-orm";

import { assignments, reviews, userNotes, userSettings } from "../schema";
import type { Db } from "../types";

// Wipes the user's progress and sets the level back to 1. Every other setting and app_meta stay.
// The one allowed delete from reviews; run it in withTransaction, then rerun unlocks.
export async function resetProgress(db: Db, userId: string, now: number): Promise<void> {
  await db.delete(assignments).where(eq(assignments.userId, userId));
  await db.delete(reviews).where(eq(reviews.userId, userId));
  await db.delete(userNotes).where(eq(userNotes.userId, userId));
  await db
    .insert(userSettings)
    .values({ userId, createdAt: now })
    .onConflictDoUpdate({ target: userSettings.userId, set: { currentLevel: 1 } });
}
