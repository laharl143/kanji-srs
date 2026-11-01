import { and, asc, eq } from "drizzle-orm";

import { reviews, type NewReview, type Review } from "../schema";
import type { Db } from "../types";

// Append only. The caller supplies `row.id` (a UUID) and `row.createdAt`.
export async function insertReview(db: Db, row: NewReview): Promise<void> {
  await db.insert(reviews).values(row);
}

// Ordered by created_at, then id, so ties are stable for a later sync replay.
export async function getReviews(db: Db, userId: string, subjectId?: number): Promise<Review[]> {
  return db
    .select()
    .from(reviews)
    .where(
      subjectId === undefined
        ? eq(reviews.userId, userId)
        : and(eq(reviews.userId, userId), eq(reviews.subjectId, subjectId)),
    )
    .orderBy(asc(reviews.createdAt), asc(reviews.id));
}
