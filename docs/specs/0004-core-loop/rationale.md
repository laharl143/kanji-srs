# 0004. Core study loop: rationale

The decision record behind [index.md](index.md).

## Context

0004 was written for a Next.js web app. Spec 0001 moved the product to an offline Expo Android app on 2026-11-01, so this spec named things that no longer exist: server actions, an HTTP test clock route, a `db:seed` command, and a Playwright test. The data layer (0002) and the UI kit (0003) are now built: `getLessonQueue`, `getDueReviews`, `countDue`, `countLessons`, `insertReview`, `updateAssignment`, `insertAssignmentsIfMissing`, `upsertSubjects`, `withTransaction`, plus `Button`, `Card`, `Screen`, `Toast`, and `ConfirmDialog`. `pipeline/src`, `src/lib/srs`, `src/lib/answer`, `src/lib/content`, and `src/lib/clock` are still empty.

Forces that shaped this revision:
- **No EAS builds until the app is feature complete** (scope header, 2026-11-02). 0001 planned to prove the loop with Maestro on an `e2e` APK, and that APK cannot be built yet.
- **The tanos JLPT list license is unconfirmed**, and 0001 says to confirm it before the first pipeline run. This slice is that first run.
- **JMdict is about 60 MB of XML with custom DTD entities** (named shorthand like `&n;` declared in the file header), which makes a hand written parser the riskiest part of the pipeline.
- **All building now happens in Claude Code** (owner, 2026-11-02). IBM Bob is no longer part of the workflow, so Claude writes the level 1 mnemonics during `/develop`.
- Build approach is Tracer Bullet: one thin real thread through pipeline, bundle, database, SRS logic, and screens before anything is thickened.

## Options considered

### Option 1: Port the old plan item by item, Maestro on an early e2e APK

Keep 0004's shape, swap each Next.js piece for the 0001 equivalent, parse EDRDG XML directly, and build one `e2e` APK now to run Maestro.

**Pros**: follows 0001 to the letter; the real UI is driven end to end on day one.
**Cons**: spends one of 15 monthly builds and a slow proxy build mid development, against the scope rule; the XML parser (DTD entities, streaming) is the largest and riskiest code in the slice.

### Option 2: Services first, loop proven in Vitest, JSON dictionaries (chosen)

Put lesson and review logic in plain `src/lib/study` services that take the database and `now`, prove the full loop in Vitest on `better-sqlite3`, write the Maestro flow now and run it at release, and read the dictionaries from jmdict-simplified JSON.

**Pros**: the loop is proven in every `npm test` with no device or build; screens stay thin; far less pipeline code.
**Cons**: nothing drives the real UI automatically until the release build; jmdict-simplified is a third party repackaging of EDRDG data, a new download URL to record and credit.

### Option 3: Logic in screen hooks, manual checks only

Keep the logic inside `useLessons` and `useReviews` hooks next to the routes and verify the loop by hand in Expo Go.

**Pros**: least indirection; fastest to first screen.
**Cons**: the loop test would need a React renderer, so in practice it would not exist; regressions in later slices would go unnoticed.

## Rationale

The scope's no build rule removes Option 1's main benefit, and the Vitest loop gives a stronger guard anyway: it runs on every commit through the pre commit hook, while a Maestro run happens rarely. Driving services rather than hooks is what makes that test possible, and it matches 0001 §3 ("hooks and services glue the layers"). jmdict-simplified carries the same EDRDG data under the same CC BY-SA 4.0 license, so the content contract is unchanged; the cost is one more source line in `SOURCES.json` and Credits, which is far cheaper than an entity aware streaming XML parser.

Small calls made here (pick, then runner up):
- **Content version import**: keep 0001's `content/content-version.txt` and add `.txt` to the `inline-import` Babel plugin and Metro `sourceExts`, as already done for `.sql`. Runner up: a `content-version.json`, rejected because it renames a file 0001 fixes.
- **Review ids**: services take a `newId` function; the app passes `expo-crypto` `randomUUID`, tests pass Node's `crypto.randomUUID`. `expo-crypto` ships in Expo Go and adds no `app.json` plugin, so it needs no early build. Runner up: a pure JS uuid package, rejected as one more dependency for the same result.
- **Service errors**: services return `{ ok: true, ... } | { ok: false, error: "not_due" | "not_found" | "not_pending" }` instead of throwing, so screens handle them without try and catch. Runner up: typed error classes.
- **Session queue**: a pure module with an injected `random` function, so shuffling is deterministic in tests.
- **Download behind the proxy**: Node's built in `fetch`, routed through `HTTPS_PROXY` with undici's `EnvHttpProxyAgent` (undici is a new dev dependency). Runner up: tell you to download by hand, kept as the fallback because present files are skipped.
- **Pipeline runner**: `tsx` as a dev dependency, as 0001 names.
