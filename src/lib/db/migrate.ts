import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useState } from "react";

import migrations from "../../../drizzle/migrations";
import { getDb } from "./client";

type Opened =
  { db: ReturnType<typeof getDb>; error?: undefined } | { db?: undefined; error: Error };

function openDb(): Opened {
  try {
    return { db: getDb() };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

const NO_MIGRATIONS = { journal: { entries: [] }, migrations: {} };

// Opens the database and runs the bundled migrations on launch. `error` covers both a failed
// open and a failed migration (spec 0002 AC-3).
export function useDbMigrations(): { ready: boolean; error: Error | undefined } {
  const [opened] = useState(openDb);
  // Hooks must run in the same order every render, so useMigrations runs even when the open
  // failed. It then gets an empty migration list and its result is ignored below.
  const state = useMigrations(
    opened.db ?? (undefined as never),
    opened.db ? migrations : NO_MIGRATIONS,
  );
  if (opened.error) return { ready: false, error: opened.error };
  return { ready: state.success, error: state.error };
}
