import { beforeEach, describe, expect, it } from "vitest";

import { subject } from "../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../tests/unit/db/harness";
import { insertAssignmentsIfMissing, updateAssignment } from "@/lib/db/queries/assignments";
import { getOrCreateSettings, updateSettings } from "@/lib/db/queries/settings";
import { upsertSubjects } from "@/lib/db/queries/subjects";

import {
  loadReminderPlan,
  markPermissionAsked,
  reminderTapRoute,
  wasPermissionAsked,
} from "./reminders";

const USER = "local";
const H = 3_600_000;
const NOW = new Date("2026-11-09T09:30:00Z");
const T = NOW.getTime();
let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await upsertSubjects(db, [
    subject({ id: 1, type: "radical", level: 1 }),
    subject({ id: 2, type: "radical", level: 1 }),
    subject({ id: 3, type: "radical", level: 1 }),
  ]);
  await getOrCreateSettings(db, USER, 0);
  await insertAssignmentsIfMissing(db, USER, [
    { subjectId: 1, srsStage: 0, unlockedAt: 0 },
    { subjectId: 2, srsStage: 0, unlockedAt: 0 },
    { subjectId: 3, srsStage: 0, unlockedAt: 0 },
  ]);
});

describe("loadReminderPlan", () => {
  it("plans from your assignments and reminder settings", async () => {
    await updateAssignment(db, USER, 1, { srsStage: 2, availableAt: T - H });
    await updateAssignment(db, USER, 2, { srsStage: 2, availableAt: T + 2 * H });
    await updateSettings(db, USER, {
      reminderDailyEnabled: true,
      reminderDailyTime: "18:00",
      reminderDueEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
    });
    const plan = await loadReminderPlan(db, USER, NOW, 0);
    expect(plan[0]).toEqual({ fireAt: new Date("2026-11-09T12:00:00Z"), kind: "due", count: 2 });
    expect(plan.filter((r) => r.kind === "daily")).toHaveLength(7);
    expect(plan.filter((r) => r.kind === "due")).toHaveLength(1);
  });

  it("plans nothing with both switches off", async () => {
    await updateAssignment(db, USER, 1, { srsStage: 2, availableAt: T + H });
    await updateSettings(db, USER, { reminderDailyEnabled: false, reminderDueEnabled: false });
    expect(await loadReminderPlan(db, USER, NOW, 0)).toEqual([]);
  });

  it("throws when startup has not made the settings row", async () => {
    await expect(loadReminderPlan(db, "someone-else", NOW, 0)).rejects.toThrow(/settings/);
  });
});

describe("reminderTapRoute", () => {
  it("opens reviews when any are due, else Home", async () => {
    expect(await reminderTapRoute(db, USER, NOW)).toBe("/");
    await updateAssignment(db, USER, 3, { srsStage: 1, availableAt: T });
    expect(await reminderTapRoute(db, USER, NOW)).toBe("/reviews");
  });
});

describe("permission asked flag", () => {
  it("is unset until marked", async () => {
    expect(await wasPermissionAsked(db)).toBe(false);
    await markPermissionAsked(db);
    expect(await wasPermissionAsked(db)).toBe(true);
  });
});
