import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type * as schema from "./schema";

// Both drivers (drizzle-orm/expo-sqlite and drizzle-orm/better-sqlite3) are "sync" mode as of
// drizzle-orm 0.45.4. The result kind stays open so the type still fits if that ever changes,
// and the run result is `any` because each driver has its own.
export type Db = BaseSQLiteDatabase<"sync" | "async", any, typeof schema>;
