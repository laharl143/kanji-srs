# 0005. Full content pipeline: rationale

The decision record behind [index.md](index.md).

## Context

Spec 0004 shipped a working pipeline: `download`, `build` (selection, levels, stable ids, a build report) and `bundle` (merges mnemonics for enabled levels and writes the content version the app reseeds from). Only level 1 has mnemonics, written by hand in a session. The license check (AC-1) and stable ids (AC-2) already work: `pipeline/src/sources.ts` records the tanos license as `usable`, and `pipeline/src/levels.test.ts` proves ids survive a rebuild.

What is missing is safety at scale. 25 levels hold about 2,400 subjects. The only checks today live inside `bundle.ts` (missing mnemonic, kanji story that does not name a radical). Nothing catches a radical in a later level than its kanji, two radicals with the same name, a kanji reading mnemonic that ignores its sound hook, or an id that changed after it shipped. `npm test` does not check content at all, although 0001 §9 says it must. There is also no tool to hand Claude Code exactly the items it needs to write, with the data each item needs, in an order that respects "radical names before kanji stories".

There is also a hole in id stability. `buildLevels` gives new items ids above the highest id in the previous `subjects.json`. An item that drops out of the selection (a JMdict pin bump, a license change) leaves that file, so if it held the highest id, the next new item gets that id. On the phone the old row and its progress still sit under that id, and the next reseed would overwrite it with a different item. That breaks 0001 §5.3 ("never reused") quietly.

Parts of the old spec went stale. It said Bob writes the mnemonics, but since 2026-11-02 all development happens in Claude Code. It named `db:seed`, which no longer exists: content reaches the phone through `pipeline:bundle` and the launch reseed in `src/lib/content/startup.ts`. And when the tanos license is not usable, the KANJIDIC2 fallback gives kanji but no vocab, so the course would lose a third of its items.

The build approach is Tracer Bullet, so the plan pushes one thin batch through the whole new path (batch, write, merge, validate) before writing all of levels 2 and 3.

## Options considered

### Option 1: Separate scripts sharing typed modules, one validator module

Each step stays its own script in `pipeline/src/` (`batch.ts`, `merge.ts`, `validate.ts` next to `build.ts` and `bundle.ts`). All content rules live in one pure module that `validate`, `merge`, `bundle`, and a Vitest test all call. The id registry stays inside `content/subjects.json`, as 0004 built it, with `content/retired.json` holding ids that left the course.

**Pros**:
- One place defines "valid content", so the script, the commit hook, merge, and bundle can never disagree.
- Pure functions over plain objects are trivial to test with small fixtures.
- Matches what 0004 already built, so nothing gets rewritten.

**Cons**:
- Several small scripts to learn instead of one command.
- One more content file (`retired.json`), empty in normal use.

### Option 2: One pipeline CLI with subcommands

A single `pipeline.ts` with `build`, `batch`, `merge`, `validate`, `bundle` subcommands and shared state.

**Pros**:
- One entry point, one argument parser.

**Cons**:
- Rewrites the working 0004 scripts for no gain in safety.
- Shared state between steps makes each step harder to test alone.

### Option 3: A pipeline script that calls the Claude API to write mnemonics

`pipeline:write` sends each batch to the API and stores the answers.

**Pros**:
- Writes all 25 levels quickly and unattended.

**Cons**:
- Needs an API key and costs money; content leaves your machine on every request.
- Harder to review: you see the result, not the conversation that shaped it.
- Claude Code in a session already does the same writing with no key and with you able to steer.

## Rationale

The real risk at 2,400 items is drift: a rule checked in one place but not another, so a batch merges fine and then the bundle refuses it, or worse, `npm test` passes on content the bundle would reject. A single pure rules module removes that whole class of bug, and it builds directly on the 0004 code instead of replacing it.

Claude Code filling batch files was the owner's choice (2026-11-02). It costs nothing extra, keeps every change as a reviewable diff, and matches how level 1 was written. The runner up, a Claude API script, would be faster for the remaining 22 levels, but it needs a key and spends money, and feature 12 can still adopt it later without changing the batch format.

For the id check, comparing against the committed `content/bundle.json` (owner's choice) tests exactly what matters: an id that already reached the phone. But the bundle only remembers the last release, so on its own it cannot stop the reuse hole described in Context: once a dropped item leaves one bundle, the next build could hand its id to a new item and nothing would notice. `content/retired.json` closes that with the least machinery: one list, written only by `build`, empty until something actually drops out, and it also lets a returning item keep its old id (so progress on it lines up again). A full separate id registry was the runner up; it would duplicate `subjects.json` and have to be kept in step on every build.
