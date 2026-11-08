import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";

import type { Meaning, SubjectType } from "@/lib/types";

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

// Full rows, mnemonics included, for the lesson pages (spec 0004) and the review session's
// "Show details" (spec 0009 AC-7). In batches, so a large review session cannot hit SQLite's
// variable limit.
export async function getSubjectsWithMnemonics(db: Db, ids: readonly number[]): Promise<Subject[]> {
  const out: Subject[] = [];
  for (const batch of chunk(ids)) {
    out.push(...(await db.select().from(subjects).where(inArray(subjects.id, batch))));
  }
  return out.sort((a, b) => a.id - b.id);
}

// One meaning list per subject, for the course word guard (spec 0007 AC-3).
export async function getAllMeanings(db: Db): Promise<Meaning[][]> {
  const rows = await db.select({ meanings: subjects.meanings }).from(subjects);
  return rows.map((r) => r.meanings);
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

// The input the progression planner needs (0001 §6.4, spec 0006): every subject, or only those
// up to `maxLevel` when it is given.
export async function getUnlockInputs(db: Db, maxLevel?: number) {
  return db
    .select({
      id: subjects.id,
      type: subjects.type,
      level: subjects.level,
      componentIds: subjects.componentIds,
    })
    .from(subjects)
    .where(maxLevel === undefined ? undefined : lte(subjects.level, maxLevel))
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

// Totals and passed counts per level and type (spec 0009 AC-8), for the Levels tab. Only levels
// that have subjects appear; a type with no subjects at a level has no row.
export async function getLevelTypeSummaries(
  db: Db,
  userId: string,
): Promise<{ level: number; type: SubjectType; total: number; passed: number }[]> {
  const rows = await db
    .select({
      level: subjects.level,
      type: subjects.type,
      total: sql<number>`count(*)`,
      passed: passedCount,
    })
    .from(subjects)
    .leftJoin(
      assignments,
      and(eq(assignments.subjectId, subjects.id), eq(assignments.userId, userId)),
    )
    .groupBy(subjects.level, subjects.type)
    .orderBy(asc(subjects.level), typeOrder);
  return rows.map((r) => ({ ...r, total: Number(r.total), passed: Number(r.passed) }));
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
