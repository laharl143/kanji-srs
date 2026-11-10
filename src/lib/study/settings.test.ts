import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { subject } from "../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../tests/unit/db/harness";
import { CONTENT_VERSION_KEY } from "@/lib/content/startup";
import {
  countToRetire,
  getAssignments,
  insertAssignmentsIfMissing,
} from "@/lib/db/queries/assignments";
import { getMeta, setMeta } from "@/lib/db/queries/meta";
import { getNote, upsertNote } from "@/lib/db/queries/notes";
import { getReviews, insertReview } from "@/lib/db/queries/reviews";
import { getOrCreateSettings, getSettings, updateSettings } from "@/lib/db/queries/settings";
import { getMaxLevel, upsertSubjects } from "@/lib/db/queries/subjects";
import { withTransaction } from "@/lib/db/transaction";

import * as progression from "./progression";
import { runProgression } from "./progression";
import {
  checkSettingsPatch,
  fromHHMM,
  getSettingsPage,
  resetAllProgress,
  saveSettings,
  skipToLevel,
  toHHMM,
  versionLine,
} from "./settings";

const USER = "local";
const NOW = new Date("2026-11-08T09:00:00Z");
const T = NOW.getTime();
let db: TestDb;

// L1: radicals 1, 2, kanji 11 (from 1), vocab 21 (from 11). L2: radical 3, kanji 12 (from 3).
// L3: radical 4, kanji 13 (from 4), vocab 22 (from 13). L4: radical 5 only, no kanji.
// L5: radical 6, kanji 14 (from 6).
beforeEach(async () => {
  db = createTestDb();
  await upsertSubjects(db, [
    subject({ id: 1, type: "radical", level: 1 }),
    subject({ id: 2, type: "radical", level: 1 }),
    subject({ id: 11, type: "kanji", level: 1, componentIds: [1] }),
    subject({ id: 21, type: "vocab", level: 1, componentIds: [11] }),
    subject({ id: 3, type: "radical", level: 2 }),
    subject({ id: 12, type: "kanji", level: 2, componentIds: [3] }),
    subject({ id: 4, type: "radical", level: 3 }),
    subject({ id: 13, type: "kanji", level: 3, componentIds: [4] }),
    subject({ id: 22, type: "vocab", level: 3, componentIds: [13] }),
    subject({ id: 5, type: "radical", level: 4 }),
    subject({ id: 6, type: "radical", level: 5 }),
    subject({ id: 14, type: "kanji", level: 5, componentIds: [6] }),
  ]);
  await getOrCreateSettings(db, USER, 0);
  await withTransaction(db, (tx) => runProgression(tx, USER, NOW));
});

const stages = async () =>
  Object.fromEntries((await getAssignments(db, USER)).map((a) => [a.subjectId, a.srsStage]));

describe("checkSettingsPatch (AC-4)", () => {
  it("accepts batch sizes 3 and 20 and refuses 2, 21, and 5.5", () => {
    expect(checkSettingsPatch({ lessonBatchSize: 3 })).toBe(true);
    expect(checkSettingsPatch({ lessonBatchSize: 20 })).toBe(true);
    expect(checkSettingsPatch({ lessonBatchSize: 2 })).toBe(false);
    expect(checkSettingsPatch({ lessonBatchSize: 21 })).toBe(false);
    expect(checkSettingsPatch({ lessonBatchSize: 5.5 })).toBe(false);
    expect(checkSettingsPatch({ lessonBatchSize: "5" })).toBe(false);
  });

  it("accepts HH:MM times and refuses 25:00, 8:00, and 08:60", () => {
    expect(checkSettingsPatch({ reminderDailyTime: "00:00", quietHoursEnd: "23:59" })).toBe(true);
    expect(checkSettingsPatch({ quietHoursStart: "25:00" })).toBe(false);
    expect(checkSettingsPatch({ quietHoursStart: "8:00" })).toBe(false);
    expect(checkSettingsPatch({ quietHoursEnd: "08:60" })).toBe(false);
  });

  it("needs booleans for the switches and refuses other keys", () => {
    expect(checkSettingsPatch({ reminderDailyEnabled: false, reminderDueEnabled: true })).toBe(
      true,
    );
    expect(checkSettingsPatch({ reminderDueEnabled: 1 })).toBe(false);
    expect(checkSettingsPatch({ currentLevel: 4 })).toBe(false);
  });
});

describe("toHHMM and fromHHMM (AC-3)", () => {
  it.each(["00:00", "08:05", "23:59"])("round trips %s", (text) => {
    const date = fromHHMM(text, NOW);
    expect(toHHMM(date)).toBe(text);
    expect(date.getDate()).toBe(NOW.getDate());
  });
});

describe("getSettingsPage (AC-1, AC-9)", () => {
  it("returns the settings row, the highest level, and the content version", async () => {
    await setMeta(db, CONTENT_VERSION_KEY, "abcdef1234567");
    const page = await getSettingsPage(db, USER);
    expect(page.settings.lessonBatchSize).toBe(5);
    expect(page.maxLevel).toBe(5);
    expect(page.contentVersion).toBe("abcdef1234567");
  });

  it("gives a null content version when none is stored", async () => {
    expect((await getSettingsPage(db, USER)).contentVersion).toBeNull();
  });

  it("throws when the settings row is missing", async () => {
    await expect(getSettingsPage(db, "nobody")).rejects.toThrow();
  });
});

describe("saveSettings (AC-2, AC-4)", () => {
  it("saves each field and returns the saved row", async () => {
    const result = await saveSettings(db, USER, { lessonBatchSize: 7, quietHoursStart: "21:30" });
    expect(result.ok && result.settings.lessonBatchSize).toBe(7);
    expect(result.ok && result.settings.quietHoursStart).toBe("21:30");
    expect((await getSettings(db, USER))?.lessonBatchSize).toBe(7);
  });

  it("starts with Anki mode off and saves the switch (spec 0012 AC-1)", async () => {
    expect((await getSettings(db, USER))?.ankiMode).toBe(false);
    const on = await saveSettings(db, USER, { ankiMode: true });
    expect(on.ok && on.settings.ankiMode).toBe(true);
    expect((await getSettings(db, USER))?.ankiMode).toBe(true);
    expect(await saveSettings(db, USER, { ankiMode: "yes" })).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("returns invalid and writes nothing for a refused value", async () => {
    expect(await saveSettings(db, USER, { lessonBatchSize: 7, quietHoursEnd: "8:00" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect((await getSettings(db, USER))?.lessonBatchSize).toBe(5);
  });

  it("throws when the settings row is missing", async () => {
    await expect(saveSettings(db, "nobody", { lessonBatchSize: 7 })).rejects.toThrow();
  });
});

describe("getMaxLevel and countToRetire (AC-5)", () => {
  it("gives the highest level with content", async () => {
    expect(await getMaxLevel(db)).toBe(5);
    expect(await getMaxLevel(createTestDb())).toBe(0);
  });

  it("counts subjects below the level that are not Retired, with or without an assignment", async () => {
    // Below level 3: 1, 2, 11, 21, 3, 12. Radicals 1 and 2 have stage 0 rows; the rest have none.
    expect(await countToRetire(db, USER, 3)).toBe(6);
    await insertAssignmentsIfMissing(db, USER, [
      { subjectId: 3, srsStage: 9, unlockedAt: 1, burnedAt: 1 },
    ]);
    expect(await countToRetire(db, USER, 3)).toBe(5);
    expect(await countToRetire(db, USER, 1)).toBe(0);
  });
});

describe("skipToLevel (AC-5, AC-6)", () => {
  it("retires levels 1 and 2 and opens level 3, writing no reviews", async () => {
    // A stage 9 row keeps its old burned_at.
    await insertAssignmentsIfMissing(db, USER, [
      { subjectId: 12, srsStage: 9, unlockedAt: 1, burnedAt: 1 },
    ]);
    expect(await skipToLevel(db, USER, 3, NOW)).toEqual({ ok: true, level: 3 });

    const rows = new Map((await getAssignments(db, USER)).map((a) => [a.subjectId, a]));
    for (const id of [1, 2, 11, 21, 3]) {
      expect(rows.get(id)).toMatchObject({
        srsStage: 9,
        unlockedAt: T,
        startedAt: T,
        passedAt: T,
        burnedAt: T,
        availableAt: null,
      });
    }
    expect(rows.get(12)?.burnedAt).toBe(1);
    // Level 3: the radical unlocks; its kanji waits for the radical to pass.
    expect(rows.get(4)?.srsStage).toBe(0);
    expect(rows.has(13)).toBe(false);
    expect(rows.has(5)).toBe(false);
    expect((await getSettings(db, USER))?.currentLevel).toBe(3);
    expect(await getReviews(db, USER)).toEqual([]);
  });

  it("refuses a level at or below yours, above the highest, or not whole, and writes nothing", async () => {
    await updateSettings(db, USER, { currentLevel: 2 });
    const before = await stages();
    for (const level of [1, 2, 6, 2.5]) {
      expect(await skipToLevel(db, USER, level, NOW)).toEqual({ ok: false, error: "invalid" });
    }
    expect(await stages()).toEqual(before);
    expect((await getSettings(db, USER))?.currentLevel).toBe(2);
  });

  it("lands above a level with no kanji and returns the level you land on", async () => {
    const result = await skipToLevel(db, USER, 4, NOW);
    expect(result).toEqual({ ok: true, level: 5 });
    expect((await getSettings(db, USER))?.currentLevel).toBe(5);
    expect((await stages())[6]).toBe(0);
  });

  it("rolls everything back when a write fails inside it", async () => {
    const before = await stages();
    const spy = vi
      .spyOn(progression, "runProgression")
      .mockRejectedValueOnce(new Error("disk full"));
    await expect(skipToLevel(db, USER, 3, NOW)).rejects.toThrow("disk full");
    spy.mockRestore();
    expect(await stages()).toEqual(before);
    expect((await getSettings(db, USER))?.currentLevel).toBe(1);
  });
});

describe("resetAllProgress (AC-7)", () => {
  it("wipes progress, reviews, and notes, keeps settings and app_meta, and unlocks level 1", async () => {
    await skipToLevel(db, USER, 3, NOW);
    await saveSettings(db, USER, { lessonBatchSize: 12, reminderDailyTime: "07:15" });
    await setMeta(db, CONTENT_VERSION_KEY, "v1");
    await insertReview(db, {
      id: randomUUID(),
      userId: USER,
      subjectId: 4,
      createdAt: T,
      startingStage: 1,
      endingStage: 2,
      incorrectMeaningCount: 0,
      incorrectReadingCount: 0,
    });
    await upsertNote(db, USER, 4, { meaningNote: "mine" }, T);

    expect(await resetAllProgress(db, USER, NOW)).toEqual({ ok: true });

    expect(await stages()).toEqual({ 1: 0, 2: 0 });
    expect(await getReviews(db, USER)).toEqual([]);
    expect(await getNote(db, USER, 4)).toBeUndefined();
    const settings = await getSettings(db, USER);
    expect(settings).toMatchObject({
      currentLevel: 1,
      lessonBatchSize: 12,
      reminderDailyTime: "07:15",
    });
    expect(await getMeta(db, CONTENT_VERSION_KEY)).toBe("v1");
  });

  it("rolls back when a write fails inside it", async () => {
    await skipToLevel(db, USER, 3, NOW);
    const before = await stages();
    // The deletes run, then the unlock step fails: nothing may stay deleted.
    const spy = vi
      .spyOn(progression, "runProgression")
      .mockRejectedValueOnce(new Error("disk full"));
    await expect(resetAllProgress(db, USER, NOW)).rejects.toThrow("disk full");
    spy.mockRestore();
    expect(await stages()).toEqual(before);
  });
});

describe("versionLine (AC-9)", () => {
  it("shows the app version and the first 7 characters of the content version", () => {
    expect(versionLine("0.1.0", "abcdef1234567")).toBe("App 0.1.0 · content abcdef1");
  });

  it("says unknown for a missing version", () => {
    expect(versionLine(undefined, null)).toBe("App unknown · content unknown");
  });
});
