import { describe, expect, it } from "vitest";

import { SOURCES } from "../../pipeline/src/sources";

import { CREDITS } from "./credits";

// Source license strings quote their names ('Creative Commons "BY"'); compare without quotes.
const plain = (text: string) => text.replace(/["']/g, "");

describe("CREDITS (spec 0010 AC-10)", () => {
  it.each(SOURCES.map((s) => [s.file, s] as const))(
    "credits %s with a matching license",
    (file, source) => {
      const covering = CREDITS.filter((c) => c.sourceFiles.includes(file));
      expect(covering.length).toBeGreaterThan(0);
      for (const credit of covering) {
        expect(plain(source.license)).toContain(credit.license);
      }
    },
  );

  it("names only files that are in SOURCES", () => {
    const files = new Set(SOURCES.map((s) => s.file));
    for (const credit of CREDITS) {
      for (const file of credit.sourceFiles) expect(files).toContain(file);
    }
  });

  it("gives every credit at least one https link", () => {
    for (const credit of CREDITS) {
      expect(credit.links.length).toBeGreaterThan(0);
      for (const link of credit.links) expect(link.url).toMatch(/^https:\/\//);
    }
  });
});
