import { getAssignments, getLessonQueue, updateAssignment } from "@/lib/db/queries/assignments";
import { getNotes, getSynonyms } from "@/lib/db/queries/notes";
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

// Mnemonics and your notes, read once with the batch or session, for the lesson page and the
// quiz's "Show details" (spec 0009 AC-7).
export type ItemDetails = {
  meaningMnemonic: string;
  readingMnemonic: string | null;
  meaningNote: string | null;
  readingNote: string | null;
};

// One lesson page: the subject with its mnemonics, plus its components' characters and meanings,
// your synonyms for the quiz (spec 0007 AC-12), and the details with your notes (spec 0009 AC-7).
export type LessonItem = {
  subject: Subject;
  components: SubjectSummary[];
  synonyms: string[];
  details: ItemDetails;
};

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
  const synonyms = await getSynonyms(db, userId);
  const notes = await getNotes(db, userId);
  return queue.map((q) => {
    const subject = full.get(q.subject.id)!;
    const note = notes.get(q.subject.id);
    return {
      subject,
      components: q.subject.componentIds.flatMap((id) => components.get(id) ?? []),
      synonyms: synonyms.get(q.subject.id) ?? [],
      details: {
        meaningMnemonic: subject.meaningMnemonic,
        readingMnemonic: subject.readingMnemonic,
        meaningNote: note?.meaningNote ?? null,
        readingNote: note?.readingNote ?? null,
      },
    };
  });
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
