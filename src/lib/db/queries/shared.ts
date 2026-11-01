import { sql } from "drizzle-orm";

import { assignments, subjects } from "../schema";

// Every subject column except the two mnemonics ("subject summary" in spec 0002).
export const subjectSummary = {
  id: subjects.id,
  type: subjects.type,
  characters: subjects.characters,
  level: subjects.level,
  position: subjects.position,
  meanings: subjects.meanings,
  readings: subjects.readings,
  componentIds: subjects.componentIds,
  jlpt: subjects.jlpt,
  frequency: subjects.frequency,
};

// Radicals, then kanji, then vocabulary.
export const typeOrder = sql`CASE ${subjects.type} WHEN 'radical' THEN 0 WHEN 'kanji' THEN 1 ELSE 2 END`;

// Passed means SRS stage 5 or higher (0001 §6.1).
export const PASSED_STAGE = 5;

// Count of passed rows in a subjects LEFT JOIN assignments group.
export const passedCount = sql<number>`coalesce(sum(CASE WHEN ${assignments.srsStage} >= ${PASSED_STAGE} THEN 1 ELSE 0 END), 0)`;

// Rows per multi row INSERT, well under SQLite's parameter limit.
export const BATCH_SIZE = 200;

export function chunk<T>(rows: readonly T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
