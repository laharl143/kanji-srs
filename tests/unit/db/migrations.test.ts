import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";
import { insertAssignmentsIfMissing } from "@/lib/db/queries/assignments";
import { insertReview } from "@/lib/db/queries/reviews";
import { upsertSubjects } from "@/lib/db/queries/subjects";

import { subject } from "./fixtures";
import { MIGRATIONS_FOLDER } from "./harness";

const TABLES = ["app_meta", "assignments", "reviews", "subjects", "user_notes", "user_settings"];

function open() {
  const sqlite = new Database(":memory:");
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

describe("migrations", () => {
  it("create every table, key, and index from spec 0002", () => {
    const { sqlite, db } = open();
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY name",
      )
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toEqual(TABLES);

    const indexes = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((r) => (r as { name: string }).name);
    expect(indexes).toEqual([
      "assignments_user_available_idx",
      "assignments_user_stage_idx",
      "reviews_user_created_idx",
      "subjects_level_type_position_idx",
      "subjects_type_characters_uq",
    ]);

    const pk = (table: string) =>
      (sqlite.pragma(`table_info(${table})`) as { name: string; pk: number }[])
        .filter((c) => c.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((c) => c.name);
    expect(pk("assignments")).toEqual(["user_id", "subject_id"]);
    expect(pk("user_notes")).toEqual(["user_id", "subject_id"]);
    expect(pk("reviews")).toEqual(["id"]);
    expect(pk("subjects")).toEqual(["id"]);
  });

  it("apply nothing on a second run and keep existing rows", async () => {
    const { sqlite, db } = open();
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    await upsertSubjects(db, [subject({ id: 1 })]);
    const applied = sqlite.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get();

    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    expect(sqlite.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get()).toEqual(applied);
    expect(sqlite.prepare("SELECT count(*) AS n FROM subjects").get()).toEqual({ n: 1 });
  });

  it("define no foreign keys, so a reseed can never cascade into progress", async () => {
    const { sqlite, db } = open();
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    for (const table of TABLES) {
      expect(sqlite.pragma(`foreign_key_list(${table})`)).toEqual([]);
    }

    await upsertSubjects(db, [subject({ id: 1 })]);
    await insertAssignmentsIfMissing(db, "local", [
      { subjectId: 1, srsStage: 3, unlockedAt: 1, availableAt: 100 },
    ]);
    await insertReview(db, {
      id: "r1",
      userId: "local",
      subjectId: 1,
      createdAt: 5,
      startingStage: 2,
      endingStage: 3,
      incorrectMeaningCount: 0,
      incorrectReadingCount: 0,
    });
    const before = sqlite.prepare("SELECT * FROM assignments").all();

    await upsertSubjects(db, [subject({ id: 1, meaningMnemonic: "new mnemonic" })]);

    expect(sqlite.prepare("SELECT meaning_mnemonic FROM subjects").get()).toEqual({
      meaning_mnemonic: "new mnemonic",
    });
    expect(sqlite.prepare("SELECT * FROM assignments").all()).toEqual(before);
    expect(sqlite.prepare("SELECT count(*) AS n FROM reviews").get()).toEqual({ n: 1 });
  });
});
