# 0004. Core study loop (tracer slice)

**Date**: 2026-10-13
**Status**: In Progress

## Summary

The first working thread through every layer: real open data becomes level 1 content, gets loaded into the database, you take a lesson, and a review moves the item up an SRS stage. Each part is narrow on purpose. Later slices (0005 to 0010) thicken one part at a time.

## Requirements

**User stories**:
- As a learner, I want to learn level 1 and review it so that the whole loop works before anything is polished.

**Acceptance criteria**:
- **AC-1**: `npm run pipeline:download` fetches KANJIDIC2, JMdict (English), KRADFILE, and the tanos N5 to N3 kanji and vocab lists into `pipeline/raw/` and writes `pipeline/raw/SOURCES.json` (url, date, sha256 each).
- **AC-2**: `npm run pipeline:build` writes `content/subjects.json` with ids, levels, and positions per 0001 §5.2 and §5.3 (full ordering logic, all levels computed).
- **AC-3**: `content/enabled-levels.json` is `[1]`, and `content/mnemonics/{radicals,kanji,vocab}.json` contain original mnemonics for every level 1 item, written by Bob per 0001 §5.4.
- **AC-4**: `npm run db:seed` loads enabled levels into `subjects`, creates the local user's settings, and unlocks level 1 radicals at stage 0.
- **AC-5**: `/lessons` shows a batch (size from settings) of stage 0 items with characters, meanings, readings, components, and mnemonics; after the quiz, each item is stage 1 with `available_at` = now + 4h rounded down to the hour.
- **AC-6**: `/reviews` asks meaning (and reading for kanji/vocab) for due items; correct moves stage +1; wrong applies the 0001 §6.3 penalty formula; a `reviews` row is written.
- **AC-7**: Reading answers are typed through `wanakana` (romaji becomes hiragana); meaning answers match exactly after lowercase and trim. (Typo tolerance and other rules come in 0007.)
- **AC-8**: `/` shows lesson count and review count with Start buttons.
- **AC-9**: Playwright test: fresh DB, seed, do one lesson batch, advance clock 4h, review all correctly, items are stage 2.

## Decision

**Chosen option**: build the real pipeline and real pure modules, narrow in breadth. No mocks or placeholder data.

## Feature design

**Clock**: `src/lib/clock.ts` exports `getNow(): Date`. Returns real time plus an offset. The offset can be changed only when `process.env.E2E === "1"`, through `POST /api/test/clock { advanceMs }`. The route returns 404 otherwise. Pure modules never call `getNow`; server actions call it and pass `now` in.

**Pure SRS (start of `src/lib/srs/`)**: `config.ts` (stages and intervals from 0001 §6.1), `schedule.ts` with
```ts
nextAvailableAt(stage: number, now: Date): Date | null   // rounded down to the hour; null at 9
completeLesson(a: Assignment, now: Date): Assignment
applyReview(a: Assignment, wrongMeaning: number, wrongReading: number, now: Date): { assignment: Assignment; review: ReviewRow }
```

**Pure answer (start of `src/lib/answer/`)**: `checkMeaning(input, subject)`, `checkReading(input, subject)` returning `"correct" | "wrong"`.

**Server actions** (`src/app/(study)/actions.ts`): `finishLessons(subjectIds)`, `submitReview({ subjectId, wrongMeaning, wrongReading })`. Each validates the subject is in the user's lesson queue or due list.

**Review session (client)**: a queue of questions `{ subjectId, kind: "meaning" | "reading" }`, shuffled; wrong answers re-queue the question and count against the item; when both questions of an item are correct, call `submitReview`.

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| finish lesson | `available_at` | `nextAvailableAt(1, getNow())` |
| submit review | new stage | `applyReview` with counts from the client session |
| dashboard | counts | `countLessons`, `countDue(userId, getNow())` |

**Critical test scenarios**:
- Happy path: the Playwright loop in AC-9, verifies **AC-4** to **AC-6**, **AC-9**
- Failure case: `submitReview` for a subject that is not due returns an error and changes nothing, verifies **AC-6**
- Unit: `applyReview` from stage 1, 4, 5, 8 with 0, 1, 2, 3 wrong answers; hour rounding, verifies **AC-5**, **AC-6**

## Build plan

1. Scripts `pipeline/src/download.ts` + `npm run pipeline:download`; parse KANJIDIC2, JMdict, KRADFILE into typed objects (`pipeline/src/parse/*.ts`) with Vitest on small fixtures, satisfies **AC-1**
2. `pipeline/src/select.ts` and `pipeline/src/levels.ts` (ordering, radical and vocab placement, id assignment), `npm run pipeline:build`, Vitest on a fixture, satisfies **AC-2**
3. Bob writes level 1 radical names and mnemonics, then level 1 kanji and vocab mnemonics, straight into `content/mnemonics/*.json`; set `enabled-levels.json` to `[1]`, satisfies **AC-3**
4. `src/lib/content/seed.ts` + `npm run db:seed`, satisfies **AC-4**
5. `src/lib/clock.ts`, `src/lib/srs/config.ts`, `src/lib/srs/schedule.ts` with Vitest, satisfies **AC-5**, **AC-6**
6. `src/lib/answer/` exact match + wanakana reading input component, satisfies **AC-7**
7. `/lessons` page and `finishLessons` action, satisfies **AC-5**
8. `/reviews` page, client session queue, `submitReview` action, satisfies **AC-6**
9. Minimal `/` with the two counts, satisfies **AC-8**
10. Playwright config (starts dev server with `E2E=1` and a temp `DATABASE_URL`) and the loop test, satisfies **AC-9**

## Consequences

**Positive**: proves pipeline, DB, SRS, and UI connect on day one.
**Negative / tradeoffs**: only level 1 is playable; no unlocking beyond the initial radicals until 0006 (kanji unlock when radicals pass).
**Neutral**: the level builder already computes all levels; 0005 adds validation, stable ids on rebuild, and the batch workflow.
