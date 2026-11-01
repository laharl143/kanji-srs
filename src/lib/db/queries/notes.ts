import { and, eq } from "drizzle-orm";

import { userNotes, type UserNote } from "../schema";
import type { Db } from "../types";

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
