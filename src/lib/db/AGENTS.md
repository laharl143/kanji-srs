# src/lib/db

The local SQLite database: Drizzle schema, startup migrations, the client, transactions, and every query the app runs. Governing spec: [docs/specs/0002-data-model/index.md](../../../docs/specs/0002-data-model/index.md).

## Files

- `schema.ts`: the one typed schema (content tables `subjects`, `app_meta`; progress tables `assignments`, `reviews`, `user_notes`, `user_settings`).
- `client.ts`: `getDb()` opens `kanji-srs.db` with `expo-sqlite` on first call (not at import), so an open failure reaches the startup gate.
- `migrate.ts`: `useDbMigrations()` runs the bundled `drizzle/` migrations on launch; `src/app/_layout.tsx` shows a blocking error screen if it fails.
- `transaction.ts`: `withTransaction(db, fn)`, the only way to group writes.
- `types.ts`: `Db`, the database type every query takes. It fits both the Expo driver and `better-sqlite3`.
- `queries/`: all query functions, one module per area.

## Rules

- **Screens and services never write raw SQL.** Add a function in `queries/` instead.
- **Every query takes `db: Db` as its first parameter**, and every progress query takes `userId` next. App code gets the user id only from `getCurrentUserId()` in `src/lib/auth/current-user.ts`, never the literal `"local"`.
- **Pass `now` in** (milliseconds). Queries never call `Date.now()`.
- **No foreign keys from progress tables to `subjects`.** `upsertSubjects` updates by id and never deletes a subject or touches a progress row, so a content reseed can never wipe progress.
- **Group writes with `withTransaction`, and write through the `tx` it hands you.** Do not call `withTransaction` inside another one (it throws), and do not pass the outer `db` inside the callback (it would wait on itself). It uses explicit `BEGIN` / `COMMIT` because Drizzle's own `transaction()` commits too early on a sync driver.
- Both Drizzle drivers in use are sync mode (drizzle-orm 0.45.4); queries still use the `await` builder form.

## Changing the schema

1. Edit `schema.ts`.
2. Run `npm run db:generate`. It writes a new SQL file and updates `drizzle/meta/` and `drizzle/migrations.js`. Commit all of `drizzle/`.
3. Never edit or delete a migration that has shipped; add a new one.
4. `npm run db:generate` should then say "No schema changes", which proves the committed migrations match the schema.

The `.sql` files ship inside the bundle through `metro.config.js` (adds the `sql` extension) and `babel.config.js` (`inline-import`).

## Tests

Query tests sit beside the modules (`queries/*.test.ts`) and run on `better-sqlite3` in memory with the real migrations, through `createTestDb()` in `tests/unit/db/harness.ts`. Migration, transaction, and `Db` type tests are in `tests/unit/db/`.

_Drafted by /sync from the introducing change, worth a quick human pass._
