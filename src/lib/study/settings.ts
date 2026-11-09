import { CONTENT_VERSION_KEY } from "@/lib/content/startup";
import { getMeta } from "@/lib/db/queries/meta";
import { resetProgress } from "@/lib/db/queries/progress";
import { raiseAssignmentsBelowLevel } from "@/lib/db/queries/assignments";
import { getSettings, updateSettings } from "@/lib/db/queries/settings";
import { getMaxLevel } from "@/lib/db/queries/subjects";
import type { UserSettings } from "@/lib/db/schema";
import { withTransaction } from "@/lib/db/transaction";
import type { Db } from "@/lib/db/types";

import { runProgression } from "./progression";

// The settings screen service (spec 0010). Every function takes `db`, then `userId`.

export const BATCH_MIN = 3;
export const BATCH_MAX = 20;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// The fields the Settings screen may change. `current_level` changes only through skip ahead
// and reset.
export type SettingsPatch = Partial<
  Pick<
    UserSettings,
    | "lessonBatchSize"
    | "reminderDailyEnabled"
    | "reminderDailyTime"
    | "reminderDueEnabled"
    | "quietHoursStart"
    | "quietHoursEnd"
  >
>;

const TIME_KEYS = ["reminderDailyTime", "quietHoursStart", "quietHoursEnd"] as const;
const SWITCH_KEYS = ["reminderDailyEnabled", "reminderDueEnabled"] as const;
const ALLOWED_KEYS = new Set<string>(["lessonBatchSize", ...TIME_KEYS, ...SWITCH_KEYS]);

/**
 * Pure check of a settings patch (spec 0010 AC-4): batch size a whole number from 3 to 20,
 * times `HH:MM` (24 hour, zero padded), switches booleans, and no other keys.
 */
export function checkSettingsPatch(patch: Record<string, unknown>): patch is SettingsPatch {
  for (const [key, value] of Object.entries(patch)) {
    if (!ALLOWED_KEYS.has(key)) return false;
    if (key === "lessonBatchSize") {
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < BATCH_MIN ||
        value > BATCH_MAX
      ) {
        return false;
      }
    } else if ((TIME_KEYS as readonly string[]).includes(key)) {
      if (typeof value !== "string" || !TIME_PATTERN.test(value)) return false;
    } else if (typeof value !== "boolean") {
      return false;
    }
  }
  return true;
}

// Local hours and minutes of `date` as `HH:MM`, zero padded.
export function toHHMM(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The day of `base` at the stored hours and minutes, local time. An unreadable text gives
// midnight, which the dialog then shows; the stored value is checked on every save.
export function fromHHMM(text: string, base: Date): Date {
  const match = TIME_PATTERN.exec(text);
  const result = new Date(base);
  result.setHours(match ? Number(text.slice(0, 2)) : 0, match ? Number(text.slice(3, 5)) : 0, 0, 0);
  return result;
}

// "App X · content Y" (spec 0010 AC-9): Y is the first 7 characters of the stored content
// version; either is "unknown" when missing.
export function versionLine(app: string | null | undefined, content: string | null): string {
  return `App ${app || "unknown"} · content ${content ? content.slice(0, 7) : "unknown"}`;
}

export type SettingsPage = {
  settings: UserSettings;
  maxLevel: number;
  contentVersion: string | null;
};

// Everything the Settings tab shows (spec 0010 AC-1). Throws on a DB failure or a missing
// settings row (startup creates it), which the screen shows as the error card.
export async function getSettingsPage(db: Db, userId: string): Promise<SettingsPage> {
  const settings = await getSettings(db, userId);
  if (!settings) throw new Error("No user settings: startup has not run");
  const maxLevel = await getMaxLevel(db);
  const contentVersion = (await getMeta(db, CONTENT_VERSION_KEY)) ?? null;
  return { settings, maxLevel, contentVersion };
}

export type SettingsResult = { ok: true; settings: UserSettings } | { ok: false; error: "invalid" };

/**
 * Saves the full value of each field in `patch` (spec 0010 AC-4) and returns the saved row. A
 * patch `checkSettingsPatch` refuses writes nothing. Throws on a DB failure or a missing row.
 */
export async function saveSettings(
  db: Db,
  userId: string,
  patch: Record<string, unknown>,
): Promise<SettingsResult> {
  if (!checkSettingsPatch(patch)) return { ok: false, error: "invalid" };
  return withTransaction(db, async (tx) => {
    if (!(await getSettings(tx, userId))) throw new Error("No user settings: startup has not run");
    await updateSettings(tx, userId, patch);
    const settings = await getSettings(tx, userId);
    return { ok: true, settings: settings! };
  });
}

export type SkipResult = { ok: true; level: number } | { ok: false; error: "invalid" };

/**
 * Skip ahead to `level` (spec 0010 AC-6), in one transaction: every subject below it becomes
 * stage 9 (Retired) with its times at `now` (rows already at 9 are left alone), the level
 * becomes `level`, then unlocks and level up run as after a review. Returns the level you land
 * on, which can be above `level` when that level has no kanji. Writes no review rows.
 */
export async function skipToLevel(
  db: Db,
  userId: string,
  level: number,
  now: Date,
): Promise<SkipResult> {
  return withTransaction(db, async (tx) => {
    const settings = await getSettings(tx, userId);
    if (!settings) throw new Error("No user settings: startup has not run");
    const maxLevel = await getMaxLevel(tx);
    if (!Number.isInteger(level) || level <= settings.currentLevel || level > maxLevel) {
      return { ok: false, error: "invalid" };
    }
    const at = now.getTime();
    await raiseAssignmentsBelowLevel(tx, userId, level, {
      srsStage: 9,
      unlockedAt: at,
      startedAt: at,
      passedAt: at,
      burnedAt: at,
      availableAt: null,
    });
    await updateSettings(tx, userId, { currentLevel: level });
    await runProgression(tx, userId, now);
    const after = await getSettings(tx, userId);
    return { ok: true, level: after!.currentLevel };
  });
}

/**
 * Reset all progress (spec 0010 AC-7), in one transaction: deletes your assignments, reviews,
 * and notes, sets the level to 1, keeps every other setting and `app_meta`, then unlocks the
 * level 1 radicals again.
 */
export async function resetAllProgress(db: Db, userId: string, now: Date): Promise<{ ok: true }> {
  return withTransaction(db, async (tx) => {
    await resetProgress(tx, userId, now.getTime());
    await runProgression(tx, userId, now);
    return { ok: true };
  });
}
