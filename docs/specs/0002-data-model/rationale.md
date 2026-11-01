# 0002. Data model and database access: rationale

_Decision record for [index.md](index.md)._

## Context

The 2026-11-01 revision of 0001 moved the app from a Next.js server with libSQL to an offline Android app. The original 0002 assumed a server process, a `DATABASE_URL`, and a `db:migrate` command run by hand. None of that exists on a phone: the database is a file the app opens itself, migrations must ship inside the APK and run on launch, and a failed migration must not silently lose progress.

Two forces shape the access layer. First, the pure SRS and answer modules are tested in Node (0001 §10), and the query layer should be too, but `expo-sqlite` only runs inside the React Native runtime. Second, 0001 §3 Boundaries says Drizzle transactions are synchronous on `better-sqlite3` and asynchronous on `expo-sqlite`. The 0002 cross check believes the Expo driver is in fact synchronous too (it wraps `openDatabaseSync`), but this is unconfirmed. Either way, Drizzle's own `transaction()` on a synchronous driver does not wait for an async callback, so the app needs one transaction helper whose behavior does not depend on the driver mode.

The data also has to stay sync shaped (0001 Deferred decisions): reviews are the future source of truth, so their ids must be safe to merge across devices, and notes need an `updated_at` for last write wins. Content is rebuilt by a reseed that upserts by id (0001 §5.6), so nothing in progress may depend on content rows through a cascading foreign key.

## Options considered

### Option 1: `expo-sqlite` with Drizzle ORM

Drizzle's `expo-sqlite` driver in the app, its `better-sqlite3` driver in tests, drizzle-kit for migrations, bundled and run with `useMigrations`.

**Pros**:
- Typed schema and queries; the same schema file drives the app, the tests, and migration generation.
- Plain SQL migration files, the same SQLite dialect a later Cloudflare D1 sync backend uses.

**Cons**:
- The Expo driver was on pre release tags at the 0001 landscape check, so versions must be pinned and some churn is expected.
- Needs Metro and Babel config so `.sql` files can be bundled.

### Option 2: `expo-sqlite` with hand written SQL

Call `expo-sqlite` directly, keep SQL strings in a query module, and write migrations as numbered SQL strings run by a small custom runner.

**Pros**:
- No ORM dependency and no pre release driver.

**Cons**:
- No types between SQL and TypeScript; every column rename is a runtime bug.
- Node tests need a second hand written adapter, and the custom migration runner is code to maintain.

### Option 3: `op-sqlite` with Drizzle

A faster third party SQLite binding with its own Drizzle driver.

**Pros**:
- Faster on large reads.

**Cons**:
- Not part of the Expo SDK, so it needs a development build instead of Expo Go, and the data set (about 4,500 subjects) gives no speed problem to solve.

## Rationale

0001 already chose the stack; this spec settles how it is wired. Option 1 is the only one that gives typed queries and Node testable data code without extra adapters, which matters because the query layer carries the SRS state the whole app depends on. The pre release risk is real but contained: versions are pinned, and the schema plus SQL migrations would survive a driver swap.

`withTransaction` uses explicit `BEGIN` / `COMMIT` / `ROLLBACK` statements on the one connection instead of Drizzle's `db.transaction()`. On a synchronous driver, `db.transaction()` commits as soon as its callback returns, before any awaited statement inside it runs, so `await` style code would escape the transaction. The explicit form is correct whether the Expo driver turns out sync or async, so build step 1 only has to confirm the mode, not pick a design. A promise chain (a simple lock, one per connection) inside the helper serializes calls, because two async callers on one connection would otherwise interleave their statements. Plain `BEGIN` is enough: with one connection there is no other writer for `IMMEDIATE` to guard against. The runner up was writing every query in the synchronous `.all()` / `.run()` form and using Drizzle's native `transaction()`. That is simpler if both drivers are sync, but it ties every query to the driver mode, which the landscape check could not confirm.

Review ids come from the caller rather than the query module, so the query layer stays free of `expo-crypto` and runs in Node.
