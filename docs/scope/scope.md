# Scope: Kanji SRS

A private, local web app that teaches Japanese kanji up to JLPT N3 with spaced repetition (radicals, then kanji, then vocabulary), built from free open data and original mnemonics. It is for you, studying on your own computer, with phone access planned later.

**Build approach:** Tracer Bullet (get one thin real thread working through every layer first, then thicken one part at a time).
**Workflow:** Alpha (after `/develop`, run `/check verify` on the real app). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· GA`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | in-progress |
| 2 | Coding standards & tooling | Foundation | planned |
| 3 | Data model | Foundation | in-progress |
| 4 | UI foundation | Foundation | in-progress |
| 5 | Core study loop | Slice 1 | in-progress |
| 6 | Full content pipeline | Slice 2 | in-progress |
| 7 | SRS progression | Slice 3 | in-progress |
| 8 | Answer checking | Slice 4 | in-progress |
| 9 | Dashboard | Slice 5 | in-progress |
| 10 | Item pages & level browser | Slice 6 | in-progress |
| 11 | Settings & credits | Slice 7 | in-progress |
| 12 | Mnemonic waves | Slice 8 | planned |

## Foundations

### 1. Stack & architecture · in-progress
Pick the stack and fix the product contract (data model, pipeline, SRS rules, screens), then scaffold a runnable Next.js project.
**Done when:** the empty scaffold boots with `npm run dev` on Windows and `npm run build` passes.
- [x] Decide the stack (spec): `/architect stack & architecture`
- [ ] Scaffold from the decision: `/develop stack & architecture`
- [ ] Verify it: `/check verify stack & architecture`
Spec 0001

### 2. Coding standards & tooling
Capture conventions from the real scaffolded project, then install lint, format, strict types, and a pre-commit hook that runs `npm test`.
**Done when:** root `AGENTS.md` reflects the real stack, and lint, format, and tests run clean on commit.
- [ ] Capture conventions + tooling choices: `/audit`
- [ ] Install the tooling: `/develop tooling`
- [ ] Verify it: `/check verify coding standards & tooling`

### 3. Data model · in-progress
Typed schema, migrations, database client, and query layer for content and progress tables, with a user id on every progress row.
**Done when:** migrations create every table in 0001 §4, rerun cleanly, and the query layer passes its tests.
- [x] Design it (spec): `/architect data model`
- [ ] Build it: `/develop data model`
   - [ ] Drizzle setup, schema, first migration (AC-1, AC-2, AC-6)
   - [ ] Client and current user helper (AC-3, AC-4)
   - [ ] Query modules with tests (AC-5, AC-6)
- [ ] Verify it: `/check verify data model`
Spec 0002

### 4. UI foundation · in-progress
Own color palette (not WaniKani's), Japanese font, app shell with nav, and base components, working at phone width and in dark mode.
**Done when:** every base component renders on the development preview page at 375px and 1280px with visible keyboard focus.
- [x] Design it (spec): `/architect UI foundation`
- [ ] Build it: `/develop UI foundation`
   - [ ] Tokens, palette, Japanese font (AC-1 to AC-3)
   - [ ] App shell and nav (AC-4)
   - [ ] Base components and preview page (AC-5)
- [ ] Verify it: `/check verify UI foundation`
Spec 0003

## Slice 1: Core study loop

### 5. Core study loop · in-progress
The walking skeleton: real open data becomes level 1, you take a lesson, and a review moves the item up a stage. Narrow, but real in every layer.
**Done when:** on a fresh database you can learn level 1 radicals, review them 4 hours later, and see them reach stage 2 (proven by the Playwright test).
- [x] Design it (spec): `/architect core study loop`
- [ ] Build it: `/develop core study loop`
   - [ ] Download, parse, and build levels (AC-1, AC-2)
   - [ ] Level 1 mnemonics and seed (AC-3, AC-4)
   - [ ] Clock, SRS schedule, exact answer checks (AC-5 to AC-7)
   - [ ] Lessons, reviews, minimal home page (AC-5, AC-6, AC-8)
   - [ ] End to end loop test (AC-9)
- [ ] Verify it: `/check verify core study loop`
Spec 0004

## Slice 2: Full content pipeline

### 6. Full content pipeline · in-progress
Make the pipeline safe to rerun: license check, stable ids, full validation, build report, and the batch workflow for writing mnemonics.
**Done when:** levels 1 to 3 pass validation and are playable, and rebuilding never changes an existing id.
- [x] Design it (spec): `/architect full content pipeline`
- [ ] Build it: `/develop full content pipeline`
   - [ ] License check and stable ids (AC-1, AC-2)
   - [ ] Validator and build report (AC-3, AC-4, AC-8)
   - [ ] Batch and merge workflow, sound hooks (AC-5, AC-6)
   - [ ] Levels 2 and 3 written and enabled (AC-7)
- [ ] Verify it: `/check verify full content pipeline`
Spec 0005

## Slice 3: SRS progression

### 7. SRS progression · in-progress
Kanji unlock when their radicals pass, vocab when its kanji pass, level up at 90%, plus wrap up and a session summary.
**Done when:** finishing level 1 radicals unlocks its kanji, passing 90% of level 1 kanji opens level 2, and wrap up works.
- [x] Design it (spec): `/architect SRS progression`
- [ ] Build it: `/develop SRS progression`
   - [ ] Unlock and level up rules with tests (AC-1 to AC-4)
   - [ ] After review routine in a transaction (AC-5)
   - [ ] Wrap up, summary, lesson ordering (AC-6, AC-7)
- [ ] Verify it: `/check verify SRS progression`
Spec 0006

## Slice 4: Answer checking

### 8. Answer checking · in-progress
Forgiving answers: typo tolerance, synonyms, katakana treated as hiragana, and a hint (not a penalty) for the wrong kind of kanji reading.
**Done when:** a small meaning typo is accepted as close, and a kun'yomi typed for an on'yomi question shakes with a hint.
- [x] Design it (spec): `/architect answer checking`
- [ ] Build it: `/develop answer checking`
   - [ ] Meaning normalizer and typo tolerance (AC-1, AC-2)
   - [ ] Reading rules: kana, wrong kind, invalid (AC-3 to AC-5)
   - [ ] UI feedback (AC-4 to AC-7)
- [ ] Verify it: `/check verify answer checking`
Spec 0007

## Slice 5: Dashboard

### 9. Dashboard · in-progress
What is waiting now, the next 24 hours of reviews, level progress, and items per stage.
**Done when:** the home page shows all four sections with correct numbers for a seeded user.
- [x] Design it (spec): `/architect dashboard`
- [ ] Build it: `/develop dashboard`
   - [ ] Forecast helper with tests (AC-2)
   - [ ] Query bundle and sections (AC-1, AC-3 to AC-5)
- [ ] Verify it: `/check verify dashboard`
Spec 0008

## Slice 6: Item pages & level browser

### 10. Item pages & level browser · in-progress
A page per item with used in, your notes and synonyms, spoken audio for vocab, and a level browser colored by stage.
**Done when:** a synonym added on an item page is accepted in reviews, and every level shows its items by stage.
- [x] Design it (spec): `/architect item pages & level browser`
- [ ] Build it: `/develop item pages & level browser`
   - [ ] Item page and used in (AC-1, AC-2, AC-7)
   - [ ] Notes and synonyms everywhere (AC-3, AC-4)
   - [ ] Level browser and speak button (AC-5, AC-6)
- [ ] Verify it: `/check verify item pages & level browser`
Spec 0009

## Slice 7: Settings & credits

### 11. Settings & credits · in-progress
Lesson batch size, skip ahead to a level, reset progress, and the credits page the data licenses require.
**Done when:** skipping to level 3 retires levels 1 and 2 and opens level 3, and credits list every source.
- [x] Design it (spec): `/architect settings & credits`
- [ ] Build it: `/develop settings & credits`
   - [ ] Batch size setting (AC-1)
   - [ ] Skip ahead and reset (AC-2, AC-3)
   - [ ] Credits page and footer link (AC-4, AC-5)
- [ ] Verify it: `/check verify settings & credits`
Spec 0010

## Slice 8: Mnemonic waves

### 12. Mnemonic waves
Write original radical names and mnemonics for levels 4 to the last level, a few levels at a time, using the batch workflow and rules from 0001 §5.4 and 0005. Enable each wave once it passes validation.
**Done when:** every level is enabled and `npm run pipeline:validate` passes.
- [ ] Write and enable the next wave: `/develop mnemonic waves`
- [ ] Verify it: `/check verify mnemonic waves`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **VOICEVOX audio**: generated audio files for vocab, with credit per VOICEVOX terms · needs a decision
- **Phone access**: hosted database, login, deploy · needs a decision
- **Kana only vocabulary**: words written without kanji
- **Example sentences**: from an openly licensed corpus · needs a decision
- **Stroke order**: animated stroke order from open data · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Skills locate it by that `(spec)` suffix. Every other box is an execution box and `/architect` never ticks one.

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling).
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history). Designed features show `in-progress` because their spec is captured.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing; **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`.
- **Pointer line** (`Spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
