import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import shippedBundle from "../../../content/bundle.json";
import { subject } from "../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../tests/unit/db/harness";
import { getAssignments, updateAssignment } from "@/lib/db/queries/assignments";
import { getMeta } from "@/lib/db/queries/meta";
import { getSettings } from "@/lib/db/queries/settings";
import { getSubject, getSubjectsWithMnemonics } from "@/lib/db/queries/subjects";

import { CONTENT_VERSION_KEY, runStartup } from "./startup";
import type { Bundle, BundledContent, BundleSubject } from "./types";

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

describe("runStartup, progress outside the bundle (spec 0005 AC-8)", () => {
  let warn: MockInstance<typeof console.warn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it("after a reseed, warns about assignments whose subject left the bundle and keeps them", async () => {
    await runStartup(db, USER, content("v1"), NOW);
    expect(warn).not.toHaveBeenCalled();

    // Subject 4 has an assignment and is gone from the new bundle.
    const next = subjects.filter((s) => s.id !== 4);
    expect(await runStartup(db, USER, content("v2", next), NOW)).toEqual({ reseeded: true });

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "reseed: 1 assignments point at subjects not in the bundle: 4",
    );
    expect((await getAssignments(db, USER)).map((a) => a.subjectId)).toEqual([1, 2, 4]);
    expect(await getSubject(db, 4)).toBeDefined();
  });

  it("lists the count and only the first 20 ids", async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      subject({ id: i + 1, type: "radical", level: 1 }),
    ) as BundleSubject[];
    await runStartup(db, USER, content("v1", many), NOW);
    const other = [subject({ id: 30, type: "radical", level: 1 })] as BundleSubject[];
    await runStartup(db, USER, content("v2", other), NOW);
    const first20 = Array.from({ length: 20 }, (_, i) => i + 1).join(", ");
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      `reseed: 25 assignments point at subjects not in the bundle: ${first20}`,
    );
  });

  it("checks nothing when the version did not change", async () => {
    await runStartup(db, USER, content("v1"), NOW);
    const next = subjects.filter((s) => s.id !== 4);
    expect(await runStartup(db, USER, content("v1", next), NOW)).toEqual({ reseeded: false });
    expect(warn).not.toHaveBeenCalled();
  });

  it("never fails startup when the check itself fails", async () => {
    await runStartup(db, USER, content("v1"), NOW);
    db.run(sql`DROP TABLE assignments`);

    await expect(runStartup(db, USER, content("v2"), NOW)).resolves.toEqual({ reseeded: true });

    expect(await getMeta(db, CONTENT_VERSION_KEY)).toBe("v2");
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "reseed: could not check assignments against the bundle",
      expect.any(Error),
    );
  });
});

describe("runStartup with the shipped bundle (spec 0005 AC-7)", () => {
  const read = (file: string) =>
    readFileSync(new URL(`../../../content/${file}`, import.meta.url), "utf8");

  it("reseeds every level 1 to 3 subject in the course, mnemonics included", async () => {
    // The course comes from subjects.json, so a subject missing from the bundle fails here.
    const course = JSON.parse(read("subjects.json")) as { id: number; level: number }[];
    const wanted = course
      .filter((s) => s.level <= 3)
      .map((s) => s.id)
      .sort((a, b) => a - b);
    const shipped: BundledContent = {
      bundle: shippedBundle as Bundle,
      version: read("content-version.txt").trim(),
    };

    expect(await runStartup(db, USER, shipped, NOW)).toEqual({ reseeded: true });

    const rows = await getSubjectsWithMnemonics(db, wanted);
    expect(rows.map((r) => r.id)).toEqual(wanted);
    const unwritten = rows.filter((r) =>
      r.type === "vocab"
        ? !r.readingMnemonic
        : !r.meaningMnemonic || (r.type === "kanji" && !r.readingMnemonic),
    );
    expect(unwritten.map((r) => `${r.type}:${r.characters}`)).toEqual([]);
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
