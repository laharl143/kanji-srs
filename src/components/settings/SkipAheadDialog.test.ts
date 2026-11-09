// The skip ahead preview line (spec 0010 AC-5): what the dialog says while counting, after a
// failed count, and for zero, one, and many items.
import { describe, expect, it, vi } from "vitest";

// previewText is pure; stub the dialog's imports so the module loads in node.
vi.mock("react-native", () => ({ Text: () => null, View: () => null }));
vi.mock("@/components/ui", () => ({ ConfirmDialog: () => null }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserId: () => "user-1" }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/db/queries/assignments", () => ({ countToRetire: () => Promise.resolve(0) }));
vi.mock("./Stepper", () => ({ Stepper: () => null }));

const { previewText } = await import("./SkipAheadDialog");

describe("previewText (spec 0010 AC-5)", () => {
  // covers: AC-5
  it("says it is counting while the count loads", () => {
    expect(previewText({ status: "loading" }, 4)).toBe("Counting items…");
  });

  it("asks to try again when the count failed", () => {
    expect(previewText({ status: "error" }, 4)).toBe("Could not count items. Try again.");
  });

  // covers: AC-5
  it("says nothing retires when the count is zero", () => {
    expect(previewText({ status: "ready", n: 0 }, 4)).toBe(
      "Nothing to retire. You move to level 4.",
    );
  });

  // covers: AC-5
  it("uses the singular for one item", () => {
    expect(previewText({ status: "ready", n: 1 }, 4)).toBe(
      "1 item below level 4 become Retired. They will not come up for review. You cannot undo this.",
    );
  });

  // covers: AC-5
  it("names the count and the level for many items", () => {
    expect(previewText({ status: "ready", n: 37 }, 9)).toBe(
      "37 items below level 9 become Retired. They will not come up for review. You cannot undo this.",
    );
  });
});
