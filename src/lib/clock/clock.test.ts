import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestDb } from "../../../tests/unit/db/harness";
import { getMeta, setMeta } from "@/lib/db/queries/meta";

import { CLOCK_OFFSET_KEY, getClockOffset, loadClockOffset, now, setClockOffset } from "./index";

const HOUR = 3_600_000;

afterEach(async () => {
  await setClockOffset(createTestDb(), 0);
  vi.useRealTimers();
});

describe("clock", () => {
  it("now() is the device time plus the offset", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T10:00:00Z") });
    expect(now().toISOString()).toBe("2026-11-02T10:00:00.000Z");
    await setClockOffset(createTestDb(), 4 * HOUR);
    expect(now().toISOString()).toBe("2026-11-02T14:00:00.000Z");
  });

  it("setClockOffset saves the offset in app_meta", async () => {
    const db = createTestDb();
    await setClockOffset(db, 8 * HOUR);
    expect(await getMeta(db, CLOCK_OFFSET_KEY)).toBe(String(8 * HOUR));
    expect(getClockOffset()).toBe(8 * HOUR);
  });

  it("loadClockOffset restores a saved offset, and treats a missing or bad one as 0", async () => {
    const db = createTestDb();
    await setMeta(db, CLOCK_OFFSET_KEY, String(HOUR));
    await loadClockOffset(db);
    expect(getClockOffset()).toBe(HOUR);

    await loadClockOffset(createTestDb());
    expect(getClockOffset()).toBe(0);

    await setMeta(db, CLOCK_OFFSET_KEY, "not a number");
    await loadClockOffset(db);
    expect(getClockOffset()).toBe(0);
  });
});
