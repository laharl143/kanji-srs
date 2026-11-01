import { sql } from "drizzle-orm";

import type { Db } from "./types";

// Per connection queue: each call waits for the one before it (spec 0002 AC-7).
const tails = new WeakMap<Db, Promise<unknown>>();
// Every `tx` handed to a callback, mapped to its connection, so a nested call can be caught.
const openTxs = new WeakMap<Db, Db>();

/**
 * Runs `fn` inside BEGIN / COMMIT on the connection, rolling back if it throws.
 * Explicit statements instead of Drizzle's `transaction()`, which on a sync driver commits
 * before any awaited statement inside the callback runs. Calls on one connection run one after
 * the other. `tx` is the same connection; write through it. Calling withTransaction with a
 * `tx` (a nested transaction) throws instead of waiting on itself forever.
 */
export async function withTransaction<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  if (openTxs.has(db)) throw new Error("nested withTransaction");

  const previous = tails.get(db) ?? Promise.resolve();
  const run = previous.then(async () => {
    const tx: Db = Object.create(db);
    openTxs.set(tx, db);
    await db.run(sql`BEGIN`);
    try {
      const result = await fn(tx);
      await db.run(sql`COMMIT`);
      return result;
    } catch (error) {
      try {
        await db.run(sql`ROLLBACK`);
      } catch {
        // SQLite may already have rolled back (for example on a full disk); keep the first error.
      }
      throw error;
    } finally {
      openTxs.delete(tx);
    }
  });
  tails.set(
    db,
    run.catch(() => {}),
  );
  return run;
}
