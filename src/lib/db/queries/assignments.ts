import {
  and,
  asc,
  between,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";

import { assignments, subjects, type Assignment, type NewAssignment } from "../schema";
import type { Db } from "../types";
import { chunk, passedCount, subjectSummary, typeOrder } from "./shared";

export type AssignmentInput = Omit<NewAssignment, "userId">;
export type AssignmentPatch = Partial<Omit<Assignment, "userId" | "subjectId">>;

// Stages 1 to 8 are in review; 0 is a pending lesson and 9 is retired.
const inReview = between(assignments.srsStage, 1, 8);

function isDue(userId: string, now: number) {
  return and(eq(assignments.userId, userId), inReview, lte(assignments.availableAt, now));
}

export async function getAssignments(
  db: Db,
  userId: string,
  subjectIds?: readonly number[],
): Promise<Assignment[]> {
  if (subjectIds && subjectIds.length === 0) return [];
  return db
    .select()
    .from(assignments)
    .where(
      subjectIds
        ? and(eq(assignments.userId, userId), inArray(assignments.subjectId, [...subjectIds]))
        : eq(assignments.userId, userId),
    )
    .orderBy(asc(assignments.subjectId));
}

export async function getLessonQueue(db: Db, userId: string, limit: number) {
  return db
    .select({ assignment: assignments, subject: subjectSummary })
    .from(assignments)
    .innerJoin(subjects, eq(subjects.id, assignments.subjectId))
    .where(and(eq(assignments.userId, userId), eq(assignments.srsStage, 0)))
    .orderBy(asc(subjects.level), typeOrder, asc(subjects.position))
    .limit(limit);
}

// No limit: the review session (0004) decides order and size.
export async function getDueReviews(db: Db, userId: string, now: number) {
  return db
    .select({ assignment: assignments, subject: subjectSummary })
    .from(assignments)
    .innerJoin(subjects, eq(subjects.id, assignments.subjectId))
    .where(isDue(userId, now))
    .orderBy(asc(assignments.availableAt), asc(assignments.subjectId));
}

// Same filter and join as getDueReviews, so the count always matches the queue.
export async function countDue(db: Db, userId: string, now: number): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(assignments)
    .innerJoin(subjects, eq(subjects.id, assignments.subjectId))
    .where(isDue(userId, now));
  return rows[0]?.n ?? 0;
}

export async function countLessons(db: Db, userId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(assignments)
    .innerJoin(subjects, eq(subjects.id, assignments.subjectId))
    .where(and(eq(assignments.userId, userId), eq(assignments.srsStage, 0)));
  return rows[0]?.n ?? 0;
}

// Progress rows whose subject is gone, so the caller can log and skip them (0001 §9).
export async function getOrphanAssignments(db: Db, userId: string): Promise<Assignment[]> {
  const rows = await db
    .select({ assignment: assignments })
    .from(assignments)
    .leftJoin(subjects, eq(subjects.id, assignments.subjectId))
    .where(and(eq(assignments.userId, userId), isNull(subjects.id)))
    .orderBy(asc(assignments.subjectId));
  return rows.map((r) => r.assignment);
}

// Raw times in [from, to); the pure caller buckets them into local hours.
export async function getForecast(
  db: Db,
  userId: string,
  from: number,
  to: number,
): Promise<number[]> {
  const rows = await db
    .select({ availableAt: assignments.availableAt })
    .from(assignments)
    .where(
      and(
        eq(assignments.userId, userId),
        inReview,
        gte(assignments.availableAt, from),
        lt(assignments.availableAt, to),
      ),
    )
    .orderBy(asc(assignments.availableAt));
  return rows.map((r) => r.availableAt as number);
}

// The input src/lib/reminders needs (0001 §6.5).
export async function getScheduledAssignments(
  db: Db,
  userId: string,
): Promise<{ subjectId: number; srsStage: number; availableAt: number }[]> {
  const rows = await db
    .select({
      subjectId: assignments.subjectId,
      srsStage: assignments.srsStage,
      availableAt: assignments.availableAt,
    })
    .from(assignments)
    .where(and(eq(assignments.userId, userId), inReview, isNotNull(assignments.availableAt)))
    .orderBy(asc(assignments.availableAt), asc(assignments.subjectId));
  return rows.map((r) => ({ ...r, availableAt: r.availableAt as number }));
}

export async function getStageCounts(
  db: Db,
  userId: string,
): Promise<{ stage: number; count: number }[]> {
  return db
    .select({ stage: assignments.srsStage, count: count() })
    .from(assignments)
    .where(eq(assignments.userId, userId))
    .groupBy(assignments.srsStage)
    .orderBy(asc(assignments.srsStage));
}

export async function getLevelProgress(db: Db, userId: string, level: number) {
  return db
    .select({ type: subjects.type, total: sql<number>`count(*)`, passed: passedCount })
    .from(subjects)
    .leftJoin(
      assignments,
      and(eq(assignments.subjectId, subjects.id), eq(assignments.userId, userId)),
    )
    .where(eq(subjects.level, level))
    .groupBy(subjects.type)
    .orderBy(typeOrder);
}

// Unlock only: an existing row is never touched, so a stage is never reset.
export async function insertAssignmentsIfMissing(
  db: Db,
  userId: string,
  rows: readonly AssignmentInput[],
): Promise<void> {
  for (const batch of chunk(rows.map((r) => ({ ...r, userId })))) {
    await db.insert(assignments).values(batch).onConflictDoNothing();
  }
}

// Writes only the columns in `patch` (lesson done, review result).
export async function updateAssignment(
  db: Db,
  userId: string,
  subjectId: number,
  patch: AssignmentPatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db
    .update(assignments)
    .set(patch)
    .where(and(eq(assignments.userId, userId), eq(assignments.subjectId, subjectId)));
}

/**
 * Development and e2e builds only (spec 0006 AC-11): every assignment of a subject at `level`
 * with stage 0 to 4 moves to stage 4, due at `now`, with `started_at` set to `now` where it is
 * empty. Rows already at stage 4 count too and are made due. Writes no reviews rows. Returns how
 * many rows moved.
 */
export async function promoteLevelForTesting(
  db: Db,
  userId: string,
  level: number,
  now: number,
): Promise<number> {
  const atLevel = db.select({ id: subjects.id }).from(subjects).where(eq(subjects.level, level));
  const moved = await db
    .update(assignments)
    .set({
      srsStage: 4,
      availableAt: now,
      startedAt: sql`coalesce(${assignments.startedAt}, ${now})`,
    })
    .where(
      and(
        eq(assignments.userId, userId),
        between(assignments.srsStage, 0, 4),
        inArray(assignments.subjectId, atLevel),
      ),
    )
    .returning({ subjectId: assignments.subjectId });
  return moved.length;
}

// Skip ahead: every subject below `level` ends up at least at `values.srsStage`; never lowers one.
export async function raiseAssignmentsBelowLevel(
  db: Db,
  userId: string,
  level: number,
  values: Omit<AssignmentInput, "subjectId"> & { srsStage: number },
): Promise<void> {
  const below = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(lt(subjects.level, level));
  const rows = below.map((s) => ({ ...values, userId, subjectId: s.id }));
  for (const batch of chunk(rows)) {
    await db
      .insert(assignments)
      .values(batch)
      .onConflictDoUpdate({
        target: [assignments.userId, assignments.subjectId],
        set: values,
        setWhere: sql`${assignments.srsStage} < ${values.srsStage}`,
      });
  }
}
