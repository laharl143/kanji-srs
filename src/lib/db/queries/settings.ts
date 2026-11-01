import { eq } from "drizzle-orm";

import { userSettings, type UserSettings } from "../schema";
import type { Db } from "../types";

export type SettingsPatch = Partial<Omit<UserSettings, "userId" | "createdAt">>;

export async function getOrCreateSettings(
  db: Db,
  userId: string,
  now: number,
): Promise<UserSettings> {
  await db.insert(userSettings).values({ userId, createdAt: now }).onConflictDoNothing();
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  return rows[0]!;
}

// Writes only the fields in `patch`; bounds checks belong to the settings feature (0010).
export async function updateSettings(db: Db, userId: string, patch: SettingsPatch): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(userSettings).set(patch).where(eq(userSettings.userId, userId));
}
