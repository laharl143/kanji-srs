import { beforeEach, describe, expect, it } from "vitest";

import { subject } from "../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../tests/unit/db/harness";
import { getAssignments, updateAssignment } from "@/lib/db/queries/assignments";
import { getMeta } from "@/lib/db/queries/meta";
import { getSettings } from "@/lib/db/queries/settings";
import { getSubject, getSubjectsWithMnemonics } from "@/lib/db/queries/subjects";

import { CONTENT_VERSION_KEY, runStartup } from "./startup";
import type { BundledContent, BundleSubject } from "./types";

const USER = "local";
const NOW = new Date("2026-11-02T10:30:00Z");

const subjects = [
  subject({ id: 1, type: "radical", level: 1 }),
  subject({ id: 2, type: "radical", level: 1 }),
  subject({ id: 3, type: "kanji", level: 1, componentIds: [1, 2] }),
  subject({ id: 4, type: "kanji", level: 1, componentIds: [] }),
  subject({ id: 5, type: "vocab", level: 1, componentIds: [3] }),
  subject({ id: 6, type: "radical", level: 2 }),
  subject({ id: 7, type: "kanji", level: 2, componentIds: [] }),
] as BundleSubject[];

const content = (version: string, rows: BundleSubject[] = subjects): BundledContent => ({
  bundle: { subjects: rows },
  version,
});

let db: TestDb;
beforeEach(() => {
  db = createTestDb();
});

describe("runStartup", () => {
  it("on first launch seeds subjects, creates settings, and unlocks the level 1 starting set", async () => {
    expect(await runStartup(db, USER, content("v1"), NOW)).toEqual({ reseeded: true });

    expect(await getMeta(db, CONTENT_VERSION_KEY)).toBe("v1");
    expect(await getSettings(db, USER)).toMatchObject({ lessonBatchSize: 5, currentLevel: 1 });
    const rows = await getAssignments(db, USER);
    expect(rows.map((a) => a.subjectId)).toEqual([1, 2, 4]);
    expect(rows[0]).toEqual({
      userId: USER,
      subjectId: 1,
      srsStage: 0,
      unlockedAt: NOW.getTime(),
      startedAt: null,
      availableAt: null,
      passedAt: null,
      burnedAt: null,
    });
  });

  it("changes nothing on a relaunch with the same version", async () => {
    await runStartup(db, USER, content("v1"), NOW);
    await updateAssignment(db, USER, 1, { srsStage: 3 });
    const edited = { ...subjects[0], meaningMnemonic: "changed" };

    const again = await runStartup(db, USER, content("v1", [edited, ...subjects.slice(1)]), NOW);

    expect(again).toEqual({ reseeded: false });
    expect((await getSubject(db, 1))?.meaningMnemonic).toBe("mnemonic 1");
    expect((await getAssignments(db, USER, [1]))[0].srsStage).toBe(3);
  });

  it("a new version updates subjects and keeps progress, never deleting a subject", async () => {
    await runStartup(db, USER, content("v1"), NOW);
    await updateAssignment(db, USER, 2, { srsStage: 4, startedAt: 1, availableAt: 2 });
    const before = await getAssignments(db, USER);
    const later = new Date(NOW.getTime() + 86_400_000);
    // Subject 7 is gone from the new bundle and subject 1 has a new mnemonic.
    const next = [{ ...subjects[0], meaningMnemonic: "new story" }, ...subjects.slice(1, 6)];

    expect(await runStartup(db, USER, content("v2", next), later)).toEqual({ reseeded: true });

    expect(await getMeta(db, CONTENT_VERSION_KEY)).toBe("v2");
    expect((await getSubject(db, 1))?.meaningMnemonic).toBe("new story");
    expect(await getSubject(db, 7)).toBeDefined();
    expect(await getAssignments(db, USER)).toEqual(before);
  });

  it("rolls back every write when the reseed fails", async () => {
    const broken = [{ ...subjects[0], characters: null }] as unknown as BundleSubject[];
    await expect(runStartup(db, USER, content("v1", broken), NOW)).rejects.toThrow();
    expect(await getMeta(db, CONTENT_VERSION_KEY)).toBeUndefined();
    expect(await getSettings(db, USER)).toBeUndefined();
    expect(await getAssignments(db, USER)).toEqual([]);
  });
});

describe("getSubjectsWithMnemonics", () => {
  it("returns full rows, mnemonics included, ordered by id", async () => {
    await runStartup(db, USER, content("v1"), NOW);
    const rows = await getSubjectsWithMnemonics(db, [3, 1]);
    expect(rows.map((r) => [r.id, r.meaningMnemonic])).toEqual([
      [1, "mnemonic 1"],
      [3, "mnemonic 3"],
    ]);
    expect(await getSubjectsWithMnemonics(db, [])).toEqual([]);
  });
});
