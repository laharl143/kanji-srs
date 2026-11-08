import { getAssignments } from "@/lib/db/queries/assignments";
import { getNote, upsertNote } from "@/lib/db/queries/notes";
import {
  getSubject,
  getSubjectsByIds,
  getUsedIn,
  type SubjectSummary,
} from "@/lib/db/queries/subjects";
import type { Assignment, Subject } from "@/lib/db/schema";
import { withTransaction } from "@/lib/db/transaction";
import type { Db } from "@/lib/db/types";
import { checkSynonym, type SynonymRefusal } from "@/lib/answer/synonym";

import type { ServiceResult } from "./result";

// A subject shown as a chip or tile, with its SRS stage (null when locked: no assignment).
export type Chip = SubjectSummary & { stage: number | null };

export type ItemNote = {
  meaningNote: string | null;
  readingNote: string | null;
  synonyms: string[];
};

export type ItemPage = {
  subject: Subject;
  assignment?: Assignment;
  components: Chip[];
  usedIn: Chip[];
  note: ItemNote;
};

export const NOTE_MAX_LENGTH = 1000;

const emptyNote: ItemNote = { meaningNote: null, readingNote: null, synonyms: [] };

// Attaches each subject's stage, keeping the input order.
export async function withStages(
  db: Db,
  userId: string,
  subjects: readonly SubjectSummary[],
): Promise<Chip[]> {
  const ids = subjects.map((s) => s.id);
  const stages = new Map((await getAssignments(db, userId, ids)).map((a) => [a.subjectId, a]));
  return subjects.map((s) => ({ ...s, stage: stages.get(s.id)?.srsStage ?? null }));
}

/**
 * Everything the item page shows (spec 0009 AC-1, AC-2): the subject, its assignment, its
 * components in `component_ids` order, the subjects that use it (level, type, position), and
 * your note. `null` when no subject has that id. Locked items load too.
 */
export async function getItemPage(
  db: Db,
  userId: string,
  subjectId: number,
): Promise<ItemPage | null> {
  const subject = await getSubject(db, subjectId);
  if (!subject) return null;
  const [assignment] = await getAssignments(db, userId, [subjectId]);
  const byId = new Map(
    (await getSubjectsByIds(db, subject.componentIds)).map((s) => [s.id, s] as const),
  );
  const components = await withStages(
    db,
    userId,
    subject.componentIds.flatMap((id) => byId.get(id) ?? []),
  );
  const usedIn = await withStages(db, userId, await getUsedIn(db, subjectId));
  const row = await getNote(db, userId, subjectId);
  const note: ItemNote = row
    ? { meaningNote: row.meaningNote, readingNote: row.readingNote, synonyms: row.synonyms ?? [] }
    : emptyNote;
  return { subject, assignment, components, usedIn, note };
}

// Trimmed and capped at 1000 characters; empty becomes null (clears the note).
function cleanNote(text: string | null | undefined): string | null | undefined {
  if (text === undefined) return undefined;
  if (text === null) return null;
  const trimmed = text.trim().slice(0, NOTE_MAX_LENGTH);
  return trimmed === "" ? null : trimmed;
}

/**
 * Saves your meaning or reading note (spec 0009 AC-4). A field left out keeps its value; an
 * empty one clears it. Works with no assignment and no notes row (it inserts one). Returns the
 * saved values so the card updates without a reload. A throw means a DB failure.
 */
export async function saveNote(
  db: Db,
  userId: string,
  subjectId: number,
  patch: { meaningNote?: string | null; readingNote?: string | null },
  now: number,
): Promise<ServiceResult<{ ok: true; note: ItemNote }, "not_found">> {
  return withTransaction(db, async (tx) => {
    if (!(await getSubject(tx, subjectId))) return { ok: false, error: "not_found" };
    await upsertNote(
      tx,
      userId,
      subjectId,
      { meaningNote: cleanNote(patch.meaningNote), readingNote: cleanNote(patch.readingNote) },
      now,
    );
    const row = await getNote(tx, userId, subjectId);
    return {
      ok: true,
      note: {
        meaningNote: row?.meaningNote ?? null,
        readingNote: row?.readingNote ?? null,
        synonyms: row?.synonyms ?? [],
      },
    };
  });
}

// Its own type, since ServiceResult cannot carry a refusal reason.
export type SynonymResult =
  | { ok: true; synonyms: string[] }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "invalid"; reason: SynonymRefusal };

/**
 * Adds a synonym (spec 0009 AC-5) after `checkSynonym`. Reads and writes in one transaction, so
 * two quick taps cannot lose one. The next lesson quiz or review session accepts it.
 */
export async function addSynonym(
  db: Db,
  userId: string,
  subjectId: number,
  text: string,
  now: number,
): Promise<SynonymResult> {
  return withTransaction(db, async (tx) => {
    const subject = await getSubject(tx, subjectId);
    if (!subject) return { ok: false, error: "not_found" };
    const current = (await getNote(tx, userId, subjectId))?.synonyms ?? [];
    const check = checkSynonym(text, subject.meanings, current);
    if (!check.ok) return { ok: false, error: "invalid", reason: check.reason };
    const synonyms = [...current, check.value];
    await upsertNote(tx, userId, subjectId, { synonyms }, now);
    return { ok: true, synonyms };
  });
}

// Removes the synonym whose stored text is exactly `text` (spec 0009 AC-5).
export async function removeSynonym(
  db: Db,
  userId: string,
  subjectId: number,
  text: string,
  now: number,
): Promise<ServiceResult<{ ok: true; synonyms: string[] }, "not_found">> {
  return withTransaction(db, async (tx) => {
    if (!(await getSubject(tx, subjectId))) return { ok: false, error: "not_found" };
    const current = (await getNote(tx, userId, subjectId))?.synonyms ?? [];
    const synonyms = current.filter((s) => s !== text);
    await upsertNote(tx, userId, subjectId, { synonyms }, now);
    return { ok: true, synonyms };
  });
}
