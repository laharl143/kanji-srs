import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";

import * as schema from "@/lib/db/schema";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../../drizzle", import.meta.url));

// A fresh in memory database with the app's real migrations applied.
export function createTestDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

export type TestDb = ReturnType<typeof createTestDb>;
