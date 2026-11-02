import { getAssignments, getLessonQueue, updateAssignment } from "@/lib/db/queries/assignments";
import { getSettings } from "@/lib/db/queries/settings";
import {
  getSubjectsByIds,
  getSubjectsWithMnemonics,
  type SubjectSummary,
} from "@/lib/db/queries/subjects";
import type { Subject } from "@/lib/db/schema";
import { withTransaction } from "@/lib/db/transaction";
import type { Db } from "@/lib/db/types";
import { completeLesson } from "@/lib/srs/schedule";

import type { ServiceResult } from "./result";

// One lesson page: the subject with its mnemonics, plus its components' characters and meanings.
export type LessonItem = { subject: Subject; components: SubjectSummary[] };

/**
 * Up to `lesson_batch_size` stage 0 items in 0001 §6.2 order (lowest level, radicals, kanji,
 * vocab, then position), spec 0004 AC-6. Settings exist once startup has run.
 */
export async function loadLessonBatch(db: Db, userId: string): Promise<LessonItem[]> {
  const settings = await getSettings(db, userId);
  if (!settings) throw new Error("No user settings: startup has not run");
  const queue = await getLessonQueue(db, userId, settings.lessonBatchSize);
  const ids = queue.map((q) => q.subject.id);
  const full = new Map((await getSubjectsWithMnemonics(db, ids)).map((s) => [s.id, s]));
  const componentIds = [...new Set(queue.flatMap((q) => q.subject.componentIds))];
  const components = new Map((await getSubjectsByIds(db, componentIds)).map((s) => [s.id, s]));
  return queue.map((q) => ({
    subject: full.get(q.subject.id)!,
    components: q.subject.componentIds.flatMap((id) => components.get(id) ?? []),
  }));
}

// The lesson quiz finished an item: stage 0 -> 1 in its own transaction (spec 0004 AC-7, AC-9).
export async function completeLessonItem(
  db: Db,
  userId: string,
  subjectId: number,
  now: Date,
): Promise<ServiceResult<{ ok: true }, "not_pending">> {
  return withTransaction(db, async (tx) => {
    const [a] = await getAssignments(tx, userId, [subjectId]);
    if (!a || a.srsStage !== 0) return { ok: false, error: "not_pending" };
    await updateAssignment(tx, userId, subjectId, completeLesson(a, now));
    return { ok: true };
  });
}
