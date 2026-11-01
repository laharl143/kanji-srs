import { eq } from "drizzle-orm";

import { appMeta } from "../schema";
import type { Db } from "../types";

export async function getMeta(db: Db, key: string): Promise<string | undefined> {
  const rows = await db.select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, key));
  return rows[0]?.value;
}

export async function setMeta(db: Db, key: string, value: string): Promise<void> {
  await db
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } });
}
