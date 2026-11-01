import type { drizzle as drizzleBetterSqlite } from "drizzle-orm/better-sqlite3";
import type { drizzle as drizzleExpo } from "drizzle-orm/expo-sqlite";
import { describe, expectTypeOf, it } from "vitest";

import type * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";

type ExpoDb = ReturnType<typeof drizzleExpo<typeof schema>>;
type NodeDb = ReturnType<typeof drizzleBetterSqlite<typeof schema>>;

describe("Db type", () => {
  it("accepts both the Expo and the better-sqlite3 database", () => {
    expectTypeOf<ExpoDb>().toExtend<Db>();
    expectTypeOf<NodeDb>().toExtend<Db>();
  });
});
