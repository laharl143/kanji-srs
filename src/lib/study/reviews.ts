import { getAssignments, getDueReviews, updateAssignment } from "@/lib/db/queries/assignments";
import { insertReview } from "@/lib/db/queries/reviews";
import type { SubjectSummary } from "@/lib/db/queries/subjects";
import type { Assignment } from "@/lib/db/schema";
import { withTransaction } from "@/lib/db/transaction";
import type { Db } from "@/lib/db/types";
import { applyReview } from "@/lib/srs/schedule";

import type { CompletedItem } from "./queue";
import type { ServiceResult } from "./result";

export type ReviewItem = { assignment: Assignment; subject: SubjectSummary };

// Every due item (stage 1 to 8, available_at <= now), no cap (spec 0004 AC-8).
export async function loadReviewSession(db: Db, userId: string, now: Date): Promise<ReviewItem[]> {
  return getDueReviews(db, userId, now.getTime());
}

/**
 * A review item is complete: in one transaction, checks it is still due as of `now`, updates
 * the assignment per 0001 §6.3, and appends one reviews row (spec 0004 AC-8, AC-9).
 */
export async function submitReview(
  db: Db,
  userId: string,
  input: CompletedItem,
  now: Date,
  newId: () => string,
): Promise<ServiceResult<{ ok: true; newStage: number }, "not_found" | "not_due">> {
  return withTransaction(db, async (tx) => {
    const [a] = await getAssignments(tx, userId, [input.subjectId]);
    if (!a) return { ok: false, error: "not_found" };
    const due =
      a.srsStage >= 1 &&
      a.srsStage <= 8 &&
      a.availableAt !== null &&
      a.availableAt <= now.getTime();
    if (!due) return { ok: false, error: "not_due" };

    const { patch, review } = applyReview(a, input.wrongMeaning, input.wrongReading, now);
    await updateAssignment(tx, userId, a.subjectId, patch);
    await insertReview(tx, { id: newId(), userId, ...review });
    return { ok: true, newStage: patch.srsStage! };
  });
}
