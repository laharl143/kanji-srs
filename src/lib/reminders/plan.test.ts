import { describe, expect, it } from "vitest";

import {
  isQuietMinute,
  MAX_REMINDERS,
  minutesOfDay,
  planReminders,
  reminderContent,
  type PlanInput,
  type ReminderAssignment,
  type ReminderSettings,
} from "./plan";

const H = 3_600_000;
// 09:30 UTC; with offset 0 the local clock is UTC.
const NOW = new Date("2026-11-09T09:30:00Z");
const T = NOW.getTime();

const OFF: ReminderSettings = {
  reminderDailyEnabled: false,
  reminderDailyTime: "08:00",
  reminderDueEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

function due(at: number, stage = 3): ReminderAssignment {
  return { srsStage: stage, availableAt: at };
}

type Over = Partial<Omit<PlanInput, "settings">> & { settings?: Partial<ReminderSettings> };

function plan(over: Over = {}) {
  return planReminders({
    assignments: over.assignments ?? [],
    now: over.now ?? NOW,
    timeZoneOffsetMinutes: over.timeZoneOffsetMinutes ?? 0,
    settings: { ...OFF, ...over.settings },
  });
}

const iso = (r: { fireAt: Date }) => r.fireAt.toISOString();
const at = (text: string) => Date.parse(text);

describe("planReminders: daily summary", () => {
  const settings = { reminderDailyEnabled: true, reminderDailyTime: "18:00" };

  it("plans one summary per day for 7 days at the chosen local time", () => {
    const result = plan({ settings, assignments: [due(T - H)] });
    expect(result.map(iso)).toEqual([
      "2026-11-09T18:00:00.000Z",
      "2026-11-10T18:00:00.000Z",
      "2026-11-11T18:00:00.000Z",
      "2026-11-12T18:00:00.000Z",
      "2026-11-13T18:00:00.000Z",
      "2026-11-14T18:00:00.000Z",
      "2026-11-15T18:00:00.000Z",
    ]);
    expect(result.every((r) => r.kind === "daily" && r.count === 1)).toBe(true);
  });

  it("skips today once the time has passed", () => {
    const result = plan({
      settings: { ...settings, reminderDailyTime: "08:00" },
      assignments: [due(T - H)],
    });
    expect(iso(result[0])).toBe("2026-11-10T08:00:00.000Z");
    expect(result).toHaveLength(6);
  });

  it("skips days with nothing due and counts what is due at each fire time", () => {
    const result = plan({
      settings,
      assignments: [due(at("2026-11-11T12:00:00Z")), due(at("2026-11-12T19:00:00Z"))],
    });
    expect(result.map((r) => [iso(r), r.count])).toEqual([
      ["2026-11-11T18:00:00.000Z", 1],
      ["2026-11-12T18:00:00.000Z", 1],
      ["2026-11-13T18:00:00.000Z", 2],
      ["2026-11-14T18:00:00.000Z", 2],
      ["2026-11-15T18:00:00.000Z", 2],
    ]);
  });

  it("only counts stages 1 to 8 with a due time", () => {
    const result = plan({
      settings,
      assignments: [
        due(T - H, 0),
        due(T - H, 9),
        { srsStage: 4, availableAt: null },
        due(T - H, 8),
        due(T - H, 1),
      ],
    });
    expect(result[0].count).toBe(2);
  });

  it("fires inside quiet hours (you chose the time)", () => {
    const result = plan({
      settings: { ...settings, reminderDailyTime: "23:00", reminderDueEnabled: true },
      assignments: [due(T - H)],
    });
    expect(iso(result[0])).toBe("2026-11-09T23:00:00.000Z");
  });

  it("uses the local time zone", () => {
    // Tokyo (+9): now is 18:30 local, so 18:00 local today has passed; tomorrow is 09:00 UTC.
    const result = plan({ settings, timeZoneOffsetMinutes: 540, assignments: [due(T - H)] });
    expect(iso(result[0])).toBe("2026-11-10T09:00:00.000Z");
    expect(result).toHaveLength(6);
  });
});

describe("planReminders: due pings", () => {
  const settings = { reminderDueEnabled: true, quietHoursStart: "00:00", quietHoursEnd: "00:00" };

  it("pings at the hour start after new reviews unlock, at most one per hour", () => {
    const result = plan({
      settings,
      assignments: [
        due(T - H), // due now: the baseline
        due(at("2026-11-09T10:10:00Z")),
        due(at("2026-11-09T10:50:00Z")),
        due(at("2026-11-09T13:00:00Z")),
      ],
    });
    expect(result.map((r) => [iso(r), r.kind, r.count])).toEqual([
      ["2026-11-09T11:00:00.000Z", "due", 3],
      ["2026-11-09T13:00:00.000Z", "due", 4],
    ]);
  });

  it("plans nothing when no new reviews unlock in the next 24 hours", () => {
    expect(plan({ settings, assignments: [due(T - H), due(T + 25 * H)] })).toEqual([]);
  });

  it("keeps to whole local hours in a half hour time zone", () => {
    // India (+5:30): 09:30 UTC is 15:00 local, so the next hour start is 16:00 local (10:30 UTC).
    const result = plan({
      settings,
      timeZoneOffsetMinutes: 330,
      assignments: [due(at("2026-11-09T10:00:00Z"))],
    });
    expect(result.map(iso)).toEqual(["2026-11-09T10:30:00.000Z"]);
  });
});

describe("planReminders: quiet hours", () => {
  const settings = { reminderDueEnabled: true, quietHoursStart: "22:00", quietHoursEnd: "07:00" };

  it("moves pings across midnight to the quiet end and merges them", () => {
    const result = plan({
      settings,
      assignments: [
        due(at("2026-11-09T21:30:00Z")), // 22:00 ping, quiet
        due(at("2026-11-10T01:30:00Z")), // 02:00 ping, quiet
        due(at("2026-11-10T06:30:00Z")), // 07:00 ping, not quiet
      ],
    });
    expect(result.map((r) => [iso(r), r.count])).toEqual([["2026-11-10T07:00:00.000Z", 3]]);
  });

  it("never fires a ping inside quiet hours", () => {
    const assignments = Array.from({ length: 24 }, (_, i) => due(T + i * H + 60_000));
    const result = plan({ settings, assignments });
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      const minute = r.fireAt.getUTCHours() * 60 + r.fireAt.getUTCMinutes();
      expect(isQuietMinute(minute, { start: 22 * 60, end: 7 * 60 })).toBe(false);
    }
  });

  it("drops a ping that shares an hour with a daily summary", () => {
    const result = plan({
      settings: { ...settings, reminderDailyEnabled: true, reminderDailyTime: "07:15" },
      assignments: [due(T - H), due(at("2026-11-10T02:00:00Z"))],
    });
    const nov10 = result.filter((r) => iso(r).startsWith("2026-11-10"));
    expect(nov10.map((r) => [iso(r), r.kind])).toEqual([["2026-11-10T07:15:00.000Z", "daily"]]);
  });

  it("keeps a ping moved to a quiet end that is not on the hour", () => {
    const result = plan({
      settings: { ...settings, quietHoursEnd: "07:30" },
      assignments: [due(at("2026-11-10T03:00:00Z"))],
    });
    expect(result.map(iso)).toEqual(["2026-11-10T07:30:00.000Z"]);
  });

  it("treats equal start and end as no quiet hours", () => {
    const result = plan({
      settings: { reminderDueEnabled: true, quietHoursStart: "08:00", quietHoursEnd: "08:00" },
      assignments: [due(at("2026-11-10T03:00:00Z"))],
    });
    expect(result.map(iso)).toEqual(["2026-11-10T03:00:00.000Z"]);
  });
});

describe("planReminders: switches and cap", () => {
  it("plans nothing with both switches off", () => {
    expect(plan({ assignments: [due(T - H), due(T + 2 * H)] })).toEqual([]);
  });

  it("never plans more than 31, sorted by fire time", () => {
    const assignments = Array.from({ length: 200 }, (_, i) => due(T - H + i * 20 * 60_000));
    const result = plan({
      settings: {
        reminderDailyEnabled: true,
        reminderDailyTime: "18:30",
        reminderDueEnabled: true,
        quietHoursStart: "00:00",
        quietHoursEnd: "00:00",
      },
      assignments,
    });
    expect(result.length).toBeLessThanOrEqual(MAX_REMINDERS);
    expect(result.filter((r) => r.kind === "daily")).toHaveLength(7);
    // One ping per hour start, minus the 18:00 hour the summary takes.
    expect(result.filter((r) => r.kind === "due")).toHaveLength(23);
    const times = result.map((r) => r.fireAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("helpers", () => {
  it("reads HH:MM", () => {
    expect(minutesOfDay("08:05")).toBe(485);
    expect(minutesOfDay("24:00")).toBeNull();
  });

  it("writes the notification text", () => {
    expect(reminderContent({ kind: "daily", count: 5 })).toEqual({
      title: "Reviews waiting",
      body: "5 reviews waiting",
    });
    expect(reminderContent({ kind: "due", count: 1 })).toEqual({
      title: "Reviews ready",
      body: "1 review is ready",
    });
  });
});
