import { describe, expect, it } from "vitest";

import { parsePositiveParam } from "./params";

describe("parsePositiveParam", () => {
  it("accepts a positive whole number", () => {
    expect(parsePositiveParam("1")).toBe(1);
    expect(parsePositiveParam("440")).toBe(440);
    expect(parsePositiveParam("999999999")).toBe(999999999);
  });

  it.each(["abc", "1.5", "0", "-1", "007", "", " 1", "1e3", "1234567890"])(
    "rejects %j",
    (value) => {
      expect(parsePositiveParam(value)).toBeNull();
    },
  );

  it("rejects a missing or repeated param", () => {
    expect(parsePositiveParam(undefined)).toBeNull();
    expect(parsePositiveParam(["1", "2"])).toBeNull();
  });
});
