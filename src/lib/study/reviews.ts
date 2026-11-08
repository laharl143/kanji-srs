import { getAssignments, getDueReviews, updateAssignment } from "@/lib/db/queries/assignments";
import { getNotes, getSynonyms } from "@/lib/db/queries/notes";
import { insertReview } from "@/lib/db/queries/reviews";
import { getSubjectsWithMnemonics, type SubjectSummary } from "@/lib/db/queries/subjects";
import type { Assignment } from "@/lib/db/schema";
import { withTransaction } from "@/lib/db/transaction";
import type { Db } from "@/lib/db/types";
import { applyReview } from "@/lib/srs/schedule";

import type { ItemDetails } from "./lessons";
import { runProgression } from "./progression";
import type { CompletedItem } from "./queue";
import type { ServiceResult } from "./result";

// A due item, with your synonyms for it beside the subject (spec 0007 AC-12), and its mnemonics
// and your notes for "Show details" (spec 0009 AC-7).
export type ReviewItem = {
  assignment: Assignment;
  subject: SubjectSummary;
  synonyms: string[];
  details: ItemDetails;
};

// A saved review: the stage before and after, how many subjects it unlocked, and the level it
// opened (null when the level did not change).
export type ReviewResult = {
  ok: true;
  startingStage: number;
  newStage: number;
  unlocked: number;
  newLevel: number | null;
};

// Every due item (stage 1 to 8, available_at <= now), no cap (spec 0004 AC-8).
export async function loadReviewSession(db: Db, userId: string, now: Date): Promise<ReviewItem[]> {
  const due = await getDueReviews(db, userId, now.getTime());
  const synonyms = await getSynonyms(db, userId);
  const notes = await getNotes(db, userId);
  const mnemonics = new Map(
    (
      await getSubjectsWithMnemonics(
        db,
        due.map((d) => d.subject.id),
      )
    ).map((s) => [s.id, s] as const),
  );
  return due.map((d) => {
    const full = mnemonics.get(d.subject.id);
    const note = notes.get(d.subject.id);
    return {
      ...d,
      synonyms: synonyms.get(d.subject.id) ?? [],
      details: {
        meaningMnemonic: full?.meaningMnemonic ?? "",
        readingMnemonic: full?.readingMnemonic ?? null,
        meaningNote: note?.meaningNote ?? null,
        readingNote: note?.readingNote ?? null,
      },
    };
  });
}

/**
 * A review item is complete. In one transaction: checks it is still due as of `now`, updates the
 * assignment per 0001 §6.3, appends one reviews row (spec 0004 AC-8, AC-9), then unlocks and
 * levels up (spec 0006 AC-4). If any step throws, nothing is written.
 */
export async function submitReview(
  db: Db,
  userId: string,
  input: CompletedItem,
  now: Date,
  newId: () => string,
): Promise<ServiceResult<ReviewResult, "not_found" | "not_due">> {
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
    const { unlocked, newLevel } = await runProgression(tx, userId, now);
    return { ok: true, startingStage: a.srsStage, newStage: patch.srsStage!, unlocked, newLevel };
  });
}
