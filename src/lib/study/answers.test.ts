import { beforeEach, describe, expect, it } from "vitest";

import { subject } from "../../../tests/unit/db/fixtures";
import { createTestDb, type TestDb } from "../../../tests/unit/db/harness";
import { normalizeMeaning } from "@/lib/answer/meaning";
import { upsertSubjects } from "@/lib/db/queries/subjects";
import type { Db } from "@/lib/db/types";

import { loadCourseForms } from "./answers";

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await upsertSubjects(db, [
    subject({ id: 1, meanings: [{ text: "Person", primary: true }] }),
    subject({
      id: 2,
      type: "vocab",
      meanings: [
        { text: "One Day", primary: true },
        { text: "Sunday", primary: false },
      ],
    }),
  ]);
});

describe("loadCourseForms (spec 0007 AC-3, AC-12)", () => {
  it("holds the normalized form of every meaning, primary or not, across subjects", async () => {
    const forms = await loadCourseForms(db);
    for (const text of ["Person", "One Day", "Sunday"]) {
      expect(forms.has(normalizeMeaning(text))).toBe(true);
    }
    expect(forms.has(normalizeMeaning("walker"))).toBe(false);
  });

  it("reads the database again on each call, so new content shows up next session", async () => {
    await loadCourseForms(db);
    await upsertSubjects(db, [subject({ id: 3, meanings: [{ text: "Month", primary: true }] })]);
    expect((await loadCourseForms(db)).has(normalizeMeaning("Month"))).toBe(true);
  });

  it("is empty for an empty course", async () => {
    expect((await loadCourseForms(createTestDb())).size).toBe(0);
  });

  // covers: AC-12 (logic side). The screens show the error card when this promise rejects; the
  // card itself is a /check verify device step.
  it("rejects when the meanings query fails, instead of resolving an empty set", async () => {
    const broken = {
      select: () => {
        throw new Error("database is locked");
      },
    } as unknown as Db;
    await expect(loadCourseForms(broken)).rejects.toThrow("database is locked");
  });
});
