import { describe, expect, it } from "vitest";

import { loadContent } from "./content";
import { formatLine, validateAll } from "./validate";

// The npm test hook for content (spec 0005 AC-3): a commit with invalid content fails here.
describe("committed content", () => {
  const content = loadContent();

  it("passes every validation rule", () => {
    expect(validateAll(content).failures.map(formatLine)).toEqual([]);
  });

  // Spec 0005 AC-7: levels 1 to 3 are fully written and shipped.
  it("enables levels 1, 2 and 3", () => {
    expect(content.enabledLevels).toEqual(expect.arrayContaining([1, 2, 3]));
  });
});
