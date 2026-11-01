import { describe, expect, it } from "vitest";

import { getMeta, setMeta } from "@/lib/db/queries/meta";
import { appMeta } from "@/lib/db/schema";
import { withTransaction } from "@/lib/db/transaction";

import { createTestDb } from "./harness";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("withTransaction", () => {
  it("commits every write when fn resolves", async () => {
    const db = createTestDb();
    const result = await withTransaction(db, async (tx) => {
      await setMeta(tx, "a", "1");
      await tick();
      await setMeta(tx, "b", "2");
      return "ok";
    });
    expect(result).toBe("ok");
    expect(await getMeta(db, "a")).toBe("1");
    expect(await getMeta(db, "b")).toBe("2");
  });

  it("rolls back every write and rethrows the original error", async () => {
    const db = createTestDb();
    const boom = new Error("boom");
    await expect(
      withTransaction(db, async (tx) => {
        await setMeta(tx, "a", "1");
        await tick();
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(await db.select().from(appMeta)).toEqual([]);
  });

  it("runs overlapping calls one after the other, in call order", async () => {
    const db = createTestDb();
    const order: string[] = [];
    const first = withTransaction(db, async (tx) => {
      order.push("first start");
      await tick();
      await setMeta(tx, "k", "first");
      order.push("first end");
    });
    const second = withTransaction(db, async (tx) => {
      order.push("second start");
      await setMeta(tx, "k", "second");
      order.push("second end");
    });
    await Promise.all([first, second]);
    expect(order).toEqual(["first start", "first end", "second start", "second end"]);
    expect(await getMeta(db, "k")).toBe("second");
  });

  it("still runs a call queued behind a failed one", async () => {
    const db = createTestDb();
    const failed = withTransaction(db, async (tx) => {
      await setMeta(tx, "a", "1");
      throw new Error("first fails");
    });
    const next = withTransaction(db, async (tx) => {
      await setMeta(tx, "b", "2");
    });
    await expect(failed).rejects.toThrow("first fails");
    await next;
    expect(await getMeta(db, "a")).toBeUndefined();
    expect(await getMeta(db, "b")).toBe("2");
  });

  it("throws on a nested call instead of waiting forever", async () => {
    const db = createTestDb();
    await expect(
      withTransaction(db, async (tx) => {
        await withTransaction(tx, async () => {});
      }),
    ).rejects.toThrow("nested withTransaction");
    // The outer transaction rolled back and the connection is usable again.
    await withTransaction(db, async (tx) => setMeta(tx, "after", "yes"));
    expect(await getMeta(db, "after")).toBe("yes");
  });
});
