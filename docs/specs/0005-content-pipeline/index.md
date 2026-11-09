# 0005. Full content pipeline

**Date**: 2026-10-13 (updated 2026-11-09)
**Status**: Accepted

## Summary

This thickens the pipeline that spec 0004 built for level 1 into something you can safely run again and again. It adds one validator that checks every content rule (and runs on every commit), a batch workflow where Claude Code writes radical names and mnemonics 25 items at a time, enforced sound hooks for kanji readings, a small `content/retired.json` so an id that leaves the course is never given to another item, and a vocab fallback for the day the tanos lists stop being usable. It ends with levels 1 to 3 fully written and enabled. Levels 4 and up are written later, in feature 12 (Mnemonic waves), with the same tools.

Decision record (context, options, rationale): [rationale.md](rationale.md). Verify steps: [verify.md](verify.md).

## Requirements

**User stories**:
- As the owner, I want every content rule checked on every commit so that broken content never reaches my phone.
- As the owner, I want Claude Code to write mnemonics in small, checked batches so that I can grow the course a level at a time and review each diff.
- As the owner, I want ids to never change or be reused so that my progress always points at the right item.

**Acceptance criteria**:
- **AC-1**: The tanos list license is checked on the site and recorded in `pipeline/src/sources.ts` and `pipeline/raw/SOURCES.json`. If not usable, the KANJIDIC2 old JLPT fallback from 0001 §5.1 is used and the build report says so. (Built with feature 5.)
- **AC-2**: Rebuilding keeps existing ids (matched on `type + characters`) and appends new ones; a test proves ids are stable across two builds with one item added. (Built with feature 5.)
- **AC-3**: `npm run pipeline:validate` enforces every rule in *Validation rules* below and exits non zero with a readable list of failures, one line per failure naming the rule, the subject (or the reading or file), and its level (`-` when there is none). `npm test` runs the same rules over the committed content, so a commit with invalid content fails the pre commit hook.
- **AC-4**: `npm run pipeline:build` prints a report: items per level and type, dropped vocab grouped by reason, kanji missing from KANJIDIC2 or KRADFILE, components with no Noto Sans JP glyph, subjects retired by this build, and which JLPT source ran (tanos or the fallbacks).
- **AC-5**: `npm run pipeline:batch -- --levels 2-3` writes `pipeline/work/batch-NNN.json` files (max 25 items of one type, only items with no mnemonic yet, radicals before kanji before vocab, each item carrying the data in *Batch item shape*). `npm run pipeline:merge` checks every filled batch and merges it into `content/mnemonics/*.json`, refusing the whole batch (merging nothing from it) if any item fails, including a stale batch whose items no longer match `subjects.json` and a batch that would overwrite text already written. Running merge again on a batch it already merged changes nothing.
- **AC-6**: Every kanji with a reading mnemonic has a sound hook for its first primary reading in `content/mnemonics/sound-hooks.json`, and its reading mnemonic contains that hook at a word start (case insensitive, so "gets" counts and "forget" does not). Each hook is one lowercase English word, no two readings share a hook, and merge refuses a batch that gives one reading two different hooks. The validator enforces all of it.
- **AC-7**: Levels 1 to 3 have every mnemonic written, pass validation, `content/enabled-levels.json` is `[1, 2, 3]`, and after the app reseeds, the phone's database holds every level 1 to 3 subject.
- **AC-8**: `npm run pipeline:bundle` refuses to write when validation fails. After a reseed commits, the app logs with `console.warn` the assignments whose subject id is not in the bundle (the count and the first 20 ids) and leaves them alone; a failure of this check never fails startup (0001 §9).
- **AC-9**: An id that leaves the course is never given to another item. `pipeline:build` records every subject that drops out of the selection in `content/retired.json`, a returning item gets its old id back, and new ids start above every id in `subjects.json` and `retired.json`.
- **AC-10**: When the tanos license is not usable, vocab come from the JMdict common words fallback (see *Vocab fallback*), and the build report says so with the count.

## Decision

**Chosen option**: Option 1: Separate scripts sharing typed modules, one validator module.

Keep each pipeline step its own script, put every content rule in one pure `pipeline/src/validate.ts` that every step and a Vitest test call, guard id reuse with `content/retired.json`, and have Claude Code write mnemonics by filling batch files in a session.

## Feature design

**Files** (all under `pipeline/src/` unless stated):

| File | Role |
|---|---|
| `content.ts` | The `Content`, `Mnemonics` (moved from `bundle.ts`) and `IdEntry` types; `loadContent(root = ".") => Content` |
| `validate.ts` | Pure rules plus `validateAll(content) => { failures, warnings }` and `validateBatch(batch, content) => Failure[]`; `main()` for `pipeline:validate` |
| `validate.test.ts` | One failing and one passing fixture per rule |
| `content.test.ts` | Runs `validateAll(loadContent())` on the real repo content and expects no failures (AC-3, the `npm test` hook) |
| `batch.ts` | `pipeline:batch`; pure `planBatches(content, levels, pending) => BatchFile[]` plus file writing |
| `merge.ts` | `pipeline:merge`; pure `mergeBatch(batch, content) => { ok: true, mnemonics, soundHooks, noop } \| { ok: false, failures }` plus file writing |
| `levels.ts` (changed) | `buildLevels(selection, previous, retired) => { subjects, retired }` |
| `bundle.ts` (changed) | `buildBundle(content) => BundleResult` runs `validateAll`, then the pure merge `bundleSubjects` (its two inline checks move to `validate.ts`) |
| `select.ts`, `build.ts` (changed) | Vocab fallback; report lines; `formatReport` takes the license as input |
| `../content/retired.json` (new) | Ids that left the course, `[]` to start |
| `../src/lib/content/startup.ts` (changed) | Logs orphan assignments after the reseed commits |
| `../pipeline/work/README.md` (changed) | The Claude Code batch workflow and a pointer to the writing rules in 0001 §5.4 |
| `../package.json` (changed) | Adds `pipeline:batch`, `pipeline:merge`, `pipeline:validate` |

**Types**:

```ts
// content.ts
type IdEntry = { id: number; type: SubjectType; characters: string };
type Content = {
  subjects: ContentSubject[];          // content/subjects.json
  mnemonics: Mnemonics;                // content/mnemonics/{radicals,kanji,vocab}.json
  soundHooks: Record<string, string>;  // content/mnemonics/sound-hooks.json, reading -> hook
  enabledLevels: number[];             // content/enabled-levels.json
  shipped: IdEntry[];                  // from content/bundle.json, [] when the file is missing
  retired: IdEntry[];                  // content/retired.json, [] when the file is missing
};

// validate.ts
type Failure = {
  rule: RuleName;
  subject: string;       // "kanji:休", "reading:せん", or a file name such as "enabled-levels.json"
  level: number | null;  // the subject's level; null for readings and files (printed "-")
  message: string;
};
```

Every printed failure and warning is one line: `[rule] subject (level N): message`.

**Data model sketch** (content files, no database change):

- `content/subjects.json`: unchanged (0004). Array of `ContentSubject`, the id registry for the current course.
- `content/retired.json` (new): array of `IdEntry`, sorted by id, written only by `pipeline:build`.
- `content/mnemonics/radicals.json`: `{ [characters]: { name, meaningMnemonic } }`; `kanji.json`: `{ [characters]: { meaningMnemonic, readingMnemonic } }`; `vocab.json`: `{ [characters]: { meaningMnemonic?, readingMnemonic } }`. Unchanged shapes. Merge adds new keys at the end of each file in batch order and never sorts or touches existing keys (the files are in subject id order today, and batches follow that order).
- `content/mnemonics/sound-hooks.json`: `{ [hiragana reading]: hookWord }`. One hook per reading; hook words unique.
- `content/enabled-levels.json`: array of level numbers.
- `pipeline/work/batch-NNN.json` (gitignored): `{ batch: number, createdAt: ISO string, levels: number[], items: BatchItem[] }`. Merged batches move to `pipeline/work/merged/`.

**Retired ids** (`buildLevels`):
- Known ids come from the previous `subjects.json`, then `retired.json`, matched on `type + characters`.
- An item in the new selection keeps its known id; one found in `retired.json` comes back with its old id and leaves that file.
- An item in the previous `subjects.json` that the new selection lacks is added to `retired.json`.
- New items get ids from one above the highest id in the previous `subjects.json` and `retired.json`.
- The report lists the subjects retired and restored by this build.

**Batch item shape** (camelCase, the same field names as the mnemonics files, so merge copies fields across; ids and levels below are illustrative):

```json
{ "type": "radical", "id": 1, "characters": "亻", "level": 2,
  "usedBy": [{ "characters": "休", "meaning": "rest" }], "usedByCount": 12,
  "name": "", "meaningMnemonic": "" }

{ "type": "kanji", "id": 140, "characters": "休", "level": 2,
  "meanings": ["rest"],
  "readings": [{ "text": "きゅう", "kind": "onyomi", "primary": true },
               { "text": "やす", "kind": "kunyomi", "primary": false }],
  "radicals": [{ "characters": "亻", "name": "<its name>" }, { "characters": "木", "name": "<its name>" }],
  "soundHook": { "reading": "きゅう", "hook": "" },
  "meaningMnemonic": "", "readingMnemonic": "" }

{ "type": "vocab", "id": 900, "characters": "休み", "level": 2,
  "meanings": ["rest", "holiday"], "readings": ["やすみ"],
  "kanji": [{ "characters": "休", "meaning": "rest", "readings": ["きゅう", "やす"], "hook": "<its hook>" }],
  "meaningMnemonic": "", "readingMnemonic": "" }
```

- `usedBy` lists at most 5 kanji (by level, then position) so a common radical such as 口 (used by over 100 kanji) does not flood the file; `usedByCount` is the full count.
- Meanings and readings are plain texts, primary first. Kanji readings are shown as stored: kun'yomi without okurigana (`やす`, not `やす.む`).
- `soundHook.hook` comes prefilled when `sound-hooks.json` already has that reading; Claude Code fills it only when it is empty, and never changes a prefilled one.
- A vocab `kanji[].hook` is that kanji's hook for its primary reading (null when it has none), so a vocab story can reuse it. A vocab `meaningMnemonic` may stay empty (0001 §5.4).

**Batch rules** (`planBatches`):
- `--levels` takes `N` or `A-B`, with every level between 1 and the highest level in `subjects.json`; anything else exits 1.
- Picks subjects in those levels that have no entry in their mnemonics file and are not already in an unmerged batch in `pipeline/work/`.
- Leaves out a kanji whose radicals do not all have a name yet, and a vocab whose kanji do not all have mnemonics yet, and prints them ("merge the earlier batches, then run batch again"). So a level takes three rounds: radicals, then kanji, then vocab.
- Orders by type (radical, kanji, vocab), then level, then position; chunks into files of at most 25, never mixing types in one file.
- Numbers files from one above the highest `NNN` in `pipeline/work/` and `pipeline/work/merged/`, padded to 3 digits.

**Merge rules** (`mergeBatch`): reads every `batch-NNN.json` in `pipeline/work/`, in number order, each against the content as left by the batches before it in the same run.
1. A batch where every writable field is still empty is skipped and stays in place ("not filled yet").
2. Otherwise it builds the candidate content (current mnemonics plus this batch, plus the new hooks from `soundHook` for readings not yet in `sound-hooks.json`) and runs `validateBatch`, which runs this fixed list and keeps only failures that involve an item of this batch:
   - `batch-identity`: each item's `type`, `id` and `characters` still match `subjects.json` (a batch planned before a rebuild fails)
   - `batch-filled`: every required field is filled (radical `name` and `meaningMnemonic`; kanji both mnemonics and `soundHook.hook`; vocab `readingMnemonic`)
   - `no-overwrite`: the subject already has different text in its mnemonics file (the same text is a no op, so a rerun after a crash is safe)
   - `hook-consistent`: two kanji in the batch give the same reading different hooks, or a prefilled hook was changed
   - `radical-name-shape`, `unique-radical-names`, `kanji-names-radicals`, `kanji-story-length`, `hook-format`, `sound-hook`, `unique-sound-hooks` (as in the table below)
3. Any failure refuses the whole batch: nothing from it is written, its failures print, the file stays to fix and rerun, and merge moves on to the next batch.
4. On success it writes the mnemonics and sound hooks files and moves the batch to `pipeline/work/merged/`.

Merge never runs the level order, enabled level, or id rules, and never edits `enabled-levels.json`; enabling a level is a separate, deliberate edit followed by `pipeline:bundle`.

**Validation rules** (each a named function in `validate.ts`; "enabled" means the level is in `enabled-levels.json`; "shipped" means the subject is in `content/bundle.json`):

| Rule | Fails when |
|---|---|
| `radical-before-kanji` | a kanji's component radical is in a later level than the kanji |
| `kanji-before-vocab` | a vocab's kanji is in a later level than the vocab |
| `has-meaning-reading` | a kanji or vocab has no meaning, or no reading |
| `enabled-has-mnemonic` | a subject in an enabled level has no mnemonic (radical: `name` and `meaningMnemonic`; kanji: both mnemonics; vocab: `readingMnemonic`) |
| `kanji-names-radicals` | a kanji meaning mnemonic does not contain every component radical's name (case insensitive), or a component radical has no name |
| `kanji-story-length` | a kanji meaning mnemonic is not 2 to 4 sentences (0001 §5.4). A sentence ends at `.`, `!` or `?` (closing quotes or brackets may follow) and then a space or the end of the text; text with no such ending counts as one sentence. Added 2026-11-09 |
| `radical-name-shape` | a radical name is not 1 to 3 words separated by single spaces |
| `unique-radical-names` | two radicals share a name (trimmed, case insensitive) |
| `hook-format` | a hook is not one lowercase English word (`^[a-z]+$`) |
| `sound-hook` | a kanji with a reading mnemonic has no hook for its first primary reading, or its reading mnemonic does not match the hook at a word start (`\b` + hook, case insensitive) |
| `unique-sound-hooks` | two readings share a hook word |
| `unique-ids` | two subjects share an id or `type + characters`; `retired.json` repeats an id or lists a subject that is in `subjects.json` |
| `stable-ids` | a shipped subject has a different id in `subjects.json`; an id in `subjects.json` belongs to a different `type + characters` in `bundle.json` or `retired.json`; a shipped subject is in neither `subjects.json` nor `retired.json` (a hand edit) |
| `enabled-levels` | `enabled-levels.json` is not `1..N` with no gaps, or names a level with no subjects |

Warnings (printed after the failures, never a failure): a shipped subject that is now retired ("still on the phone with its old text"), and mnemonic keys that match no subject. `pipeline:validate` ends with a coverage line per level (written / total). Level 1 passes every rule today (checked 2026-11-02).

**Vocab fallback** (`select.ts`, runs only when `tanosLicense !== "usable"`):
- Candidates: one per written form, from the `JmdictIndex` written forms whose kanji form is marked `common`, that contain at least one kanji, all in the selected kanji set. The entry is the first one listed (the index lists common entries first). The reading is that entry's first `common` kana form that applies to the written form (no such form, no candidate). Meanings and readings then come from `matchVocab(index, written, reading)`, as in the tanos path.
- Each candidate's JLPT level is `Math.min` of its kanji's JLPT numbers (the smaller number is the harder level).
- Walk the kanji in `orderKanji` order. For each, take up to 3 unused candidates whose latest kanji (by that order) is this one: shortest written form first (counted in code points), then the lowest JMdict id (compared as a number).
- The build report says: "Vocab source: JMdict common words fallback (tanos license is `<value>`): N words". `formatReport` gets the license value in its input instead of reading the `tanosLicense` import, so a test can print the fallback lines.
- The glyph line reads "(kept; review by hand)". There is no substitute mechanism: today 0 of 202 radicals lack a glyph.

**Orphan log** (`startup.ts`): only when `runStartup` reseeded, after the transaction commits, read `getAssignments(db, userId)` and take the subject ids that are not in the bundle. If any, `console.warn("reseed: N assignments point at subjects not in the bundle: <first 20 ids>")`. The check sits in its own `try`/`catch`; an error logs a warning and startup still returns normally. Nothing is deleted or changed. (`getOrphanAssignments` finds assignments whose subject row is gone, which cannot happen while the reseed never deletes; it stays as is.)

**API surface** (scripts):

| Command | Inputs | Output | Exit code |
|---|---|---|---|
| `npm run pipeline:validate` | content files | failures, warnings, coverage per level | 1 on any failure |
| `npm run pipeline:build` | `pipeline/raw/*`, previous `subjects.json`, `retired.json` | `subjects.json`, `retired.json`, the report | 1 on a missing raw file |
| `npm run pipeline:batch -- --levels A-B` | `--levels` (required) | `pipeline/work/batch-NNN.json` files, a summary, items left out | 1 on a bad `--levels`; 0 with "nothing to write" when all done |
| `npm run pipeline:merge` | filled batch files | per batch: merged, no op, skipped, or refused with failures | 1 if any batch was refused |
| `npm run pipeline:bundle` | content files | `bundle.json`, `content-version.txt` | 1 on any validation failure |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| batch | radical `usedBy`, `usedByCount` | kanji in `subjects.json` whose `componentIds` include the radical: first 5 by level then position, with their primary meaning; and the full count |
| batch | kanji `meanings`, `readings` | the subject's own fields: meaning texts primary first; readings as stored |
| batch | kanji `radicals[].name` | `radicals.json` by the component's characters |
| batch | kanji `soundHook.reading` | the kanji's first reading with `primary: true` |
| batch | kanji `soundHook.hook` | `sound-hooks.json[reading]`, else empty for Claude Code |
| batch | vocab `meanings`, `readings` | the subject's own fields, as texts, primary first |
| batch | vocab `kanji[]` | the vocab's `componentIds` mapped to kanji subjects: characters, primary meaning, reading texts, and the hook for its primary reading (null when none) |
| batch | pending items | `type + characters` of items in unmerged `pipeline/work/batch-*.json` |
| batch | next file number | highest `NNN` in `pipeline/work/` and `pipeline/work/merged/`, plus one |
| merge | new hooks | `soundHook.hook` of batch kanji whose reading is not yet in `sound-hooks.json` |
| validate | shipped ids | `content/bundle.json` (last committed shipped content) |
| validate | retired ids | `content/retired.json` |
| validate | enabled levels | `content/enabled-levels.json` |
| validate | failure level | the subject's `level`; null for readings and files |
| build | id for a returning item | its entry in `retired.json` |
| build | next new id | one above the highest id in the previous `subjects.json` and `retired.json` |
| build | vocab JLPT level (fallback) | `Math.min` of its kanji's JLPT numbers |
| build | license line in the report | `tanosLicense`, passed into `formatReport` |
| reseed log | orphan ids | `getAssignments(db, userId)` subject ids minus the bundle's subject ids |

**Key invariants**:
- One definition of valid content: `validate`, `merge`, `bundle`, and `npm test` all call `validate.ts`.
- Merge is all or nothing per batch, and running it again changes nothing.
- No script renumbers or reuses an id; no script deletes a mnemonic; only `build` writes `retired.json`.
- The pipeline never writes `enabled-levels.json`.
- All mnemonics and radical names are original (root ground rules 1 and 3); no batch item ever carries text from another course.

**Security model**: none beyond the ground rules. Everything runs locally; no network calls except `pipeline:download`.

**Configuration required**: none.

**Critical test scenarios**:
- Ids stable across two builds with one item added (exists), verifies **AC-2**
- A dropped item goes to `retired.json`, the next new item gets a higher id, and a returning item gets its old id back, verifies **AC-9**
- `stable-ids` fails on a changed shipped id, on a shipped id reused by another item, and on a shipped subject missing from both files; it only warns on a retired shipped subject, verifies **AC-9**, **AC-3**
- Each validation rule fails on its bad fixture and passes on its good one, verifies **AC-3**, **AC-6**
- `content.test.ts` passes on the real repo content, verifies **AC-3**
- The report shows the fallback lines when the license passed in is not usable, verifies **AC-4**, **AC-10**
- Vocab fallback picks common words, caps 3 per kanji, places each at its latest kanji, verifies **AC-10**
- `planBatches` leaves out kanji with unnamed radicals and vocab with unwritten kanji, skips written and pending items, caps at 25, never mixes types, verifies **AC-5**
- Merge refuses a batch whose kanji story misses a radical name and writes nothing from it, verifies **AC-5**
- Merge refuses a stale batch and a batch that would overwrite different text; a rerun of a merged batch is a no op; an untouched batch is skipped, verifies **AC-5**
- Merge refuses two kanji in one batch that give the same new reading different hooks, and a hook already used by another reading, verifies **AC-6**
- `buildBundle` refuses when `validateAll` returns failures, verifies **AC-8**
- A reseed whose new bundle lacks a subject with an assignment warns and keeps the row (`better-sqlite3` test), verifies **AC-8**
- A reseed from the real `content/bundle.json` leaves every level 1 to 3 subject in the database, verifies **AC-7**

## Build plan

**AC-1** and **AC-2** were built with feature 5 (2026-11-02) and need no task here; task 2 extends the id logic behind AC-2.

1. [x] `content.ts` (types and loader) and `validate.ts` with every rule and `validate.test.ts`; `pipeline:validate` script; `content.test.ts` over the real content (level 1 passes as is), satisfies **AC-3**, **AC-6**
2. [x] Retired ids: `buildLevels` reads and writes `content/retired.json` (start it as `[]`), with the new cases in `levels.test.ts`; `stable-ids` and `unique-ids` read it, satisfies **AC-9**
3. [x] `buildBundle` in `bundle.ts` runs `validateAll` before the merge (the inline checks move to `validate.ts`; the `bundle.test.ts` fixtures gain sound hooks); the reseed orphan log in `startup.ts` with its test, satisfies **AC-8**
4. [x] `batch.ts` and `merge.ts` with tests; `pipeline:batch` and `pipeline:merge` scripts; rewrite `pipeline/work/README.md` for the Claude Code workflow, satisfies **AC-5**, **AC-6**
5. [x] Tracer thread: run one batch of level 2 radicals through batch, Claude Code writes, merge, validate, so the whole path is proven on real content, satisfies **AC-5**
6. [x] Vocab fallback in `select.ts`, the report lines and the `license` input in `build.ts`, with tests, satisfies **AC-4**, **AC-10**
7. [x] Claude Code writes the rest of levels 2 and 3 through batches (radicals, then kanji, then vocab); set `enabled-levels.json` to `[1, 2, 3]`; run `pipeline:bundle`; then add the AC-7 checks (`content.test.ts` asserts the enabled levels include 1, 2 and 3; a `startup.test.ts` case reseeds from the real `content/bundle.json`) and check the reseed on the phone in Expo Go, satisfies **AC-7**

The AC-7 asserts come last on purpose: added earlier, they would fail every commit until levels 2 and 3 are written.

## Consequences

**Positive**:
- Content can grow level by level with no risk to ids or progress, and invalid content cannot be committed.
- Feature 12 (Mnemonic waves) needs no new tools: it is batch, write, merge, enable, bundle, repeated.

**Negative / tradeoffs**:
- A strict validator means some batches need rewriting before they merge, and the commit hook gets slightly slower (the real content test reads about 2,400 subjects).
- The sound hook rule forces one hook per reading across all 650 kanji, which sometimes makes a reading mnemonic a little forced.
- Each level now takes three batch rounds (radicals, kanji, vocab), because later types wait for the names and hooks they build on.
- A subject that drops out of the course keeps its old row on the phone (the reseed never deletes), so it stays studyable with its old text and still counts toward its level; the warnings make this visible, not automatic.
- Levels 2 and 3 reach the phone with AC-7, but you can only study them once feature 7 (SRS progression) adds level up.

**Neutral**:
- No database migration; the content release ships as a new `content-version.txt`, and the app upserts on launch.
- The vocab fallback only runs if the tanos license changes, so it is tested with fixtures, not real data.
- `content/retired.json` stays `[]` until a pin bump or license change drops an item.

## Follow-up

- [x] Spec 0001 §5.1, §5.3, §5.4, and §5.5 updated on 2026-11-02 to match (jmdict-simplified JSON, tanos via Internet Archive snapshots, retired ids, Claude Code as the writer, a pointer to the full rule set here), and its tanos license follow-up ticked.
- [x] Cross checked by a second model on 2026-11-02; its nine findings are folded in above (id reuse, merge rule list and reruns, hook format and matching, the `Failure` and `Content` types, the orphan check after commit, batch field sources, fallback details, and the AC-7 checks).
- [x] Rule `kanji-story-length` added on 2026-11-09 (feature 12 fix). `/check verify mnemonic waves` found 392 of 612 kanji meaning stories were one sentence, because `pipeline/work/README.md` step 2 had dropped the "2 to 4 sentences" part of 0001 §5.4. The stories were rewritten by editing `content/mnemonics/kanji.json` directly (merge refuses to overwrite), the README rule was restored, and this rule now runs in `pipeline:validate`, `pipeline:merge`, `pipeline:bundle`, and `npm test`, so the drift cannot come back. It counts sentences only; it does not judge whether a story is vivid.
