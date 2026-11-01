import { describe, expect, it } from "vitest";

import { getCurrentUserId, LOCAL_USER_ID } from "./current-user";

describe("getCurrentUserId", () => {
  it("returns the single local user", () => {
    expect(getCurrentUserId()).toBe("local");
    expect(LOCAL_USER_ID).toBe("local");
  });
});
