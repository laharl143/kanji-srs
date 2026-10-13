# 0005. Full content pipeline

**Date**: 2026-10-13
**Status**: Proposed

## Summary

Thickens the pipeline from 0004 into something safe to rerun: a license check on the word lists, ids that never change across rebuilds, every validation rule from 0001 §5.5, a build report, and the batch workflow Bob uses to write mnemonics in waves. Ends with levels 1 to 3 fully written and enabled.

## Requirements

**Acceptance criteria**:
- **AC-1**: The tanos list license is checked on the site and recorded in `pipeline/raw/SOURCES.json`. If not usable, the KANJIDIC2 old JLPT fallback from 0001 §5.1 is used and the build report says so.
- **AC-2**: Rebuilding keeps existing ids (matched on `type + characters`) and appends new ones; a test proves ids are stable across two builds with one item added.
- **AC-3**: `npm run pipeline:validate` enforces every rule in 0001 §5.5 and exits non-zero with a readable list of failures.
- **AC-4**: `npm run pipeline:build` prints a report: items per level and type, dropped vocab (no JMdict match), components with rendering doubts.
- **AC-5**: `npm run pipeline:batch -- --levels 2-3` writes `pipeline/work/batch-NNN.json` files (max 25 items, radicals before kanji before vocab, each item with the fields Bob needs); `npm run pipeline:merge` validates and merges filled batches, refusing any batch that fails validation.
- **AC-6**: `content/mnemonics/sound-hooks.json` exists and kanji reading mnemonics use the hook for their reading.
- **AC-7**: Levels 1 to 3 pass validation and `enabled-levels.json` is `[1, 2, 3]`.
- **AC-8**: `db:seed` refuses to run when validation fails and never deletes progress for missing subject ids (logs them instead), per 0001 §9.

## Decision

**Chosen option**: keep pipeline steps as separate scripts sharing typed modules in `pipeline/src/`, with an id registry stored in `content/subjects.json` itself (existing file is read before writing).

## Feature design

**Batch item shape**:
```json
{ "type": "kanji", "characters": "休", "meanings": ["rest"], "readings": [{"text":"きゅう","kind":"onyomi","primary":true}],
  "radicals": [{"characters":"亻","name":"<radical name>"},{"characters":"木","name":"<radical name>"}],
  "meaning_mnemonic": "", "reading_mnemonic": "" }
```
Radical items have `name` and `meaning_mnemonic`; vocab items list their kanji and readings and have `reading_mnemonic`.

**Validation module**: `pipeline/src/validate.ts` exports one function per rule plus `validateAll(content) => Failure[]`; each rule has a Vitest test with a failing and a passing fixture.

**Critical test scenarios**:
- Stable ids across rebuilds, verifies **AC-2**
- Each validator rule fails on its bad fixture, verifies **AC-3**
- Merge refuses a batch with a kanji mnemonic missing a radical name, verifies **AC-5**

## Build plan

1. License check and fallback path; record in `SOURCES.json`, satisfies **AC-1**
2. Id registry (read existing `subjects.json`, keep ids, append new), satisfies **AC-2**
3. `validate.ts` with all 0001 §5.5 rules and tests; `pipeline:validate` script, satisfies **AC-3**
4. Build report output, satisfies **AC-4**
5. `batch.ts` and `merge.ts` scripts plus `pipeline/work/README.md` explaining the Bob workflow, satisfies **AC-5**
6. Create `sound-hooks.json` from level 1 to 3 readings, satisfies **AC-6**
7. Bob writes levels 2 and 3 through batches; enable them, satisfies **AC-7**
8. Seed guard and missing-id logging, satisfies **AC-8**

## Consequences

**Positive**: content can grow level by level with no risk to ids or progress.
**Negative / tradeoffs**: a strict validator means some batches need rewriting before they merge.
