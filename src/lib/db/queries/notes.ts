import { and, eq } from "drizzle-orm";

import { userNotes, type UserNote } from "../schema";
import type { Db } from "../types";

// Your synonyms per subject (spec 0007 AC-12): trimmed, blanks dropped, empty lists left out.
// One query over all of your notes, never an IN list, so a large session cannot hit SQLite's
// variable limit.
export async function getSynonyms(db: Db, userId: string): Promise<Map<number, string[]>> {
  const rows = await db
    .select({ subjectId: userNotes.subjectId, synonyms: userNotes.synonyms })
    .from(userNotes)
    .where(eq(userNotes.userId, userId));
  const out = new Map<number, string[]>();
  for (const row of rows) {
    const list = (row.synonyms ?? []).map((s) => s.trim()).filter((s) => s !== "");
    if (list.length > 0) out.set(row.subjectId, list);
  }
  return out;
}

export type NotePatch = Partial<Pick<UserNote, "meaningNote" | "readingNote" | "synonyms">>;

export async function getNote(
  db: Db,
  userId: string,
  subjectId: number,
): Promise<UserNote | undefined> {
  const rows = await db
    .select()
    .from(userNotes)
    .where(and(eq(userNotes.userId, userId), eq(userNotes.subjectId, subjectId)));
  return rows[0];
}

// A field left out of `patch` keeps its value, `null` clears it, and `synonyms` is replaced as a
// whole list. The row is kept even when every field is empty.
export async function upsertNote(
  db: Db,
  userId: string,
  subjectId: number,
  patch: NotePatch,
  now: number,
): Promise<void> {
  const set: NotePatch & { updatedAt: number } = { updatedAt: now };
  if (patch.meaningNote !== undefined) set.meaningNote = patch.meaningNote;
  if (patch.readingNote !== undefined) set.readingNote = patch.readingNote;
  if (patch.synonyms !== undefined) set.synonyms = patch.synonyms;
  await db
    .insert(userNotes)
    .values({
      userId,
      subjectId,
      meaningNote: patch.meaningNote ?? null,
      readingNote: patch.readingNote ?? null,
      synonyms: patch.synonyms ?? [],
      updatedAt: now,
    })
    .onConflictDoUpdate({ target: [userNotes.userId, userNotes.subjectId], set });
}
