import { getMeta, setMeta } from "@/lib/db/queries/meta";
import type { Db } from "@/lib/db/types";

// The only module that reads the device clock (spec 0004 AC-13). Everything else takes `now`.

export const CLOCK_OFFSET_KEY = "clock_offset_ms";

// The debug clock exists in development and in the e2e build only.
export const CLOCK_DEBUG_ENABLED =
  (typeof __DEV__ !== "undefined" && __DEV__) || process.env.EXPO_PUBLIC_E2E === "1";

let offsetMs = 0;

export function now(): Date {
  return new Date(Date.now() + offsetMs);
}

export function getClockOffset(): number {
  return offsetMs;
}

// Startup only, and only when CLOCK_DEBUG_ENABLED: restores the saved offset.
export async function loadClockOffset(db: Db): Promise<void> {
  const saved = Number(await getMeta(db, CLOCK_OFFSET_KEY));
  offsetMs = Number.isFinite(saved) ? saved : 0;
}

export async function setClockOffset(db: Db, ms: number): Promise<void> {
  await setMeta(db, CLOCK_OFFSET_KEY, String(ms));
  offsetMs = ms;
}
