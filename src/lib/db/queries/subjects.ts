import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";

import { assignments, subjects, type NewSubject, type Subject } from "../schema";
import type { Db } from "../types";
import { chunk, passedCount, subjectSummary, typeOrder } from "./shared";

export type SubjectSummary = Omit<Subject, "meaningMnemonic" | "readingMnemonic">;

export async function getSubject(db: Db, id: number): Promise<Subject | undefined> {
  const rows = await db.select().from(subjects).where(eq(subjects.id, id));
  return rows[0];
}

export async function getSubjectsByLevel(db: Db, level: number): Promise<SubjectSummary[]> {
  return db
    .select(subjectSummary)
    .from(subjects)
    .where(eq(subjects.level, level))
    .orderBy(typeOrder, asc(subjects.position));
}

export async function getSubjectsByIds(db: Db, ids: readonly number[]): Promise<SubjectSummary[]> {
  if (ids.length === 0) return [];
  return db
    .select(subjectSummary)
    .from(subjects)
    .where(inArray(subjects.id, [...ids]))
    .orderBy(asc(subjects.id));
}

// Subjects that list `subjectId` among their components.
export async function getUsedIn(db: Db, subjectId: number): Promise<SubjectSummary[]> {
  return db
    .select(subjectSummary)
    .from(subjects)
    .where(
      sql`EXISTS (SELECT 1 FROM json_each(${subjects.componentIds}) WHERE value = ${subjectId})`,
    )
    .orderBy(asc(subjects.level), typeOrder, asc(subjects.position));
}

// The input computeUnlocks needs (0001 §6.4).
export async function getUnlockInputs(db: Db, maxLevel: number) {
  return db
    .select({
      id: subjects.id,
      type: subjects.type,
      level: subjects.level,
      componentIds: subjects.componentIds,
    })
    .from(subjects)
    .where(lte(subjects.level, maxLevel))
    .orderBy(asc(subjects.id));
}

export async function getLevelSummaries(
  db: Db,
  userId: string,
): Promise<{ level: number; total: number; passed: number }[]> {
  return db
    .select({ level: subjects.level, total: sql<number>`count(*)`, passed: passedCount })
    .from(subjects)
    .leftJoin(
      assignments,
      and(eq(assignments.subjectId, subjects.id), eq(assignments.userId, userId)),
    )
    .groupBy(subjects.level)
    .orderBy(asc(subjects.level));
}

// Reseed only (0001 §5.6): inserts or updates by id, never deletes, never touches progress.
export async function upsertSubjects(db: Db, rows: readonly NewSubject[]): Promise<void> {
  for (const batch of chunk(rows)) {
    await db
      .insert(subjects)
      .values(batch)
      .onConflictDoUpdate({
        target: subjects.id,
        set: {
          type: sql`excluded.type`,
          characters: sql`excluded.characters`,
          level: sql`excluded.level`,
          position: sql`excluded.position`,
          meanings: sql`excluded.meanings`,
          readings: sql`excluded.readings`,
          componentIds: sql`excluded.component_ids`,
          meaningMnemonic: sql`excluded.meaning_mnemonic`,
          readingMnemonic: sql`excluded.reading_mnemonic`,
          jlpt: sql`excluded.jlpt`,
          frequency: sql`excluded.frequency`,
        },
      });
  }
}
