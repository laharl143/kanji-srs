import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { Meaning, Reading, SubjectType } from "../types";

// Tables from spec 0002 `## Feature design`. No foreign keys and no CHECK constraints by design.

export const subjects = sqliteTable(
  "subjects",
  {
    id: integer("id").primaryKey({ autoIncrement: false }),
    type: text("type").$type<SubjectType>().notNull(),
    characters: text("characters").notNull(),
    level: integer("level").notNull(),
    position: integer("position").notNull(),
    meanings: text("meanings", { mode: "json" }).$type<Meaning[]>().notNull(),
    readings: text("readings", { mode: "json" }).$type<Reading[]>().notNull(),
    componentIds: text("component_ids", { mode: "json" }).$type<number[]>().notNull(),
    meaningMnemonic: text("meaning_mnemonic").notNull(),
    readingMnemonic: text("reading_mnemonic"),
    jlpt: integer("jlpt"),
    frequency: integer("frequency"),
  },
  (t) => [
    uniqueIndex("subjects_type_characters_uq").on(t.type, t.characters),
    index("subjects_level_type_position_idx").on(t.level, t.type, t.position),
  ],
);

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const assignments = sqliteTable(
  "assignments",
  {
    userId: text("user_id").notNull(),
    subjectId: integer("subject_id").notNull(),
    srsStage: integer("srs_stage").notNull().default(0),
    unlockedAt: integer("unlocked_at", { mode: "number" }).notNull(),
    startedAt: integer("started_at", { mode: "number" }),
    availableAt: integer("available_at", { mode: "number" }),
    passedAt: integer("passed_at", { mode: "number" }),
    burnedAt: integer("burned_at", { mode: "number" }),
  },
  (t) => [
    primaryKey({ name: "assignments_pk", columns: [t.userId, t.subjectId] }),
    index("assignments_user_available_idx").on(t.userId, t.availableAt),
    index("assignments_user_stage_idx").on(t.userId, t.srsStage),
  ],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    subjectId: integer("subject_id").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    startingStage: integer("starting_stage").notNull(),
    endingStage: integer("ending_stage").notNull(),
    incorrectMeaningCount: integer("incorrect_meaning_count").notNull(),
    incorrectReadingCount: integer("incorrect_reading_count").notNull(),
  },
  (t) => [index("reviews_user_created_idx").on(t.userId, t.createdAt)],
);

export const userNotes = sqliteTable(
  "user_notes",
  {
    userId: text("user_id").notNull(),
    subjectId: integer("subject_id").notNull(),
    meaningNote: text("meaning_note"),
    readingNote: text("reading_note"),
    synonyms: text("synonyms", { mode: "json" }).$type<string[]>().notNull().default([]),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ name: "user_notes_pk", columns: [t.userId, t.subjectId] })],
);

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id").primaryKey(),
  currentLevel: integer("current_level").notNull().default(1),
  lessonBatchSize: integer("lesson_batch_size").notNull().default(5),
  reminderDailyEnabled: integer("reminder_daily_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  reminderDailyTime: text("reminder_daily_time").notNull().default("08:00"),
  reminderDueEnabled: integer("reminder_due_enabled", { mode: "boolean" }).notNull().default(true),
  quietHoursStart: text("quiet_hours_start").notNull().default("22:00"),
  quietHoursEnd: text("quiet_hours_end").notNull().default("08:00"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type UserNote = typeof userNotes.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
