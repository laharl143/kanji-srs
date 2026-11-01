import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

import * as schema from "./schema";

export const DB_NAME = "kanji-srs.db";

type AppDb = ExpoSQLiteDatabase<typeof schema>;

// Kept on globalThis so Fast Refresh never opens a second connection.
const holder = globalThis as typeof globalThis & { __kanjiSrsDb?: AppDb };

// Opens the database on first call, not at import, so a failure reaches the startup gate.
export function getDb(): AppDb {
  if (!holder.__kanjiSrsDb) {
    const sqlite = openDatabaseSync(DB_NAME);
    sqlite.execSync("PRAGMA journal_mode = WAL;");
    sqlite.execSync("PRAGMA foreign_keys = ON;");
    holder.__kanjiSrsDb = drizzle(sqlite, { schema });
  }
  return holder.__kanjiSrsDb;
}
