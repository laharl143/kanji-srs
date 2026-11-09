# Verify: Full content pipeline · spec 0005 · updated 2026-11-09
_Steps derived from spec 0005 acceptance criteria and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

Run the commands from the repo root. For the app check, follow `docs/references/android-emulator.md` (on the office network, open Expo Go through `adb reverse tcp:8082 tcp:8082` and `exp://127.0.0.1:8082`). No screen lists level 2 and 3 items until features 7 and 10, so the database contents are proven by the `startup.test.ts` case, and the device check proves the reseed runs cleanly on the new content version.

## Commands
- [x] `npm run pipeline:validate` → exits 0 with `0 failure(s), 0 warning(s)`; coverage shows levels 1, 2 and 3 as 135/135, 127/127 and 95/95, all enabled → AC-3, AC-6, AC-7
- [x] Back up `content/mnemonics/kanji.json`, replace "umbrella" in the 今 story, run `npm run pipeline:validate` → exits 1 with `[kanji-names-radicals] kanji:今 (level 2): meaning mnemonic does not name radical "umbrella" (个)` and `1 failure(s)`; restore the backup → AC-3
- [ ] Back up `content/mnemonics/kanji.json`, cut the 今 story down to its first sentence, run `npm run pipeline:validate` → exits 1 with `[kanji-story-length] kanji:今 (level 2): meaning mnemonic has 1 sentence, needs 2 to 4` and `1 failure(s)`; restore the backup → AC-3 (rule added 2026-11-09)
- [x] `content/mnemonics/sound-hooks.json` → every value is one lowercase word and no two readings share one (validate passes `hook-format` and `unique-sound-hooks`) → AC-6
- [x] `npm run pipeline:build`, then `git diff content/subjects.json` → empty diff; `content/retired.json` is `[]`; the report shows `JLPT source: tanos N5 to N3 lists (license confirmed usable).`, `Vocab source: tanos N5 to N3 vocab lists: 1564 words`, items per level and type, dropped vocab grouped by reason, the glyph line, and the retired and restored lines → AC-1, AC-2, AC-4, AC-9
- [x] `npm run pipeline:batch -- --levels 2-3` → `nothing to write for levels 2-3` → AC-5
- [x] `npm run pipeline:batch -- --levels 4` → writes `pipeline/work/batch-013.json` (one above the highest merged batch, 012) with the 20 level 4 radicals, each `usedBy` listing at most 5 kanji next to the full `usedByCount` (up to 25), plus `batch-014.json` with the 7 level 4 kanji whose radicals already have names; the other 96 items are listed as left out. Delete both files afterwards → AC-5 (Value sourcing: next file number, `usedBy`, pending items)
- [x] `npm run pipeline:batch -- --levels 0` and `-- --levels 3-2` → exit 1 → AC-5
- [x] Copy `pipeline/work/merged/batch-012.json` back into `pipeline/work/`, run `npm run pipeline:merge` → `no op (already merged)`, the file moves back to `merged/`, and `content/mnemonics/*.json` are unchanged → AC-5
- [x] `npx vitest run pipeline/src/validate.test.ts` → one passing and one failing fixture per rule, including `stable-ids` on a changed, reused or missing shipped id (and only a warning for a retired shipped subject) → AC-3, AC-6, AC-9
- [x] `npx vitest run pipeline/src/batch.test.ts pipeline/src/merge.test.ts` → batch planning rules, refused batches write nothing, stale and overwrite refusals, reruns are no ops, hook conflicts refused → AC-5, AC-6
- [x] `npx vitest run pipeline/src/levels.test.ts` → ids stable across two builds, retired and restored ids, the JMdict common words fallback (3 per kanji, placed at the latest kanji, hardest JLPT level) and its report lines → AC-2, AC-4, AC-9, AC-10
- [x] `npx vitest run pipeline/src/bundle.test.ts` → `buildBundle` refuses on any validation failure; `content-version.txt` is the hash of `bundle.json` → AC-8
- [x] `npx vitest run src/lib/content/startup.test.ts` → the shipped bundle case (every level 1 to 3 subject in `subjects.json` lands in the database with its mnemonics) and the orphan log cases pass → AC-7, AC-8
- [x] `npx vitest run pipeline/src/content.test.ts` → the real content passes every rule and enables levels 1, 2 and 3 → AC-3, AC-7

## UI / manual
- [x] Open the app in Expo Go on a device that last ran an older content version → it reaches Home with no startup error, and Metro shows no `reseed:` warning → AC-7, AC-8
- [x] Read a sample of the new mnemonics in `content/mnemonics/*.json` (for example 友, 電, 毎, 学校, 下る) → original text in the level 1 tone, each kanji story names its radicals and ends on the primary meaning → AC-6, AC-7

## Acceptance-criteria coverage
- AC-1: build report line · AC-2: build diff, `levels.test.ts` · AC-3: validate, scratch break, `validate.test.ts`, `content.test.ts` · AC-4: build report, `levels.test.ts` · AC-5: batch and merge commands, `batch.test.ts`, `merge.test.ts` · AC-6: hooks file, validate, `merge.test.ts`, mnemonic sample · AC-7: validate coverage, `content.test.ts`, `startup.test.ts`, Expo Go launch · AC-8: `bundle.test.ts`, `startup.test.ts`, Expo Go launch · AC-9: build diff, `levels.test.ts`, `validate.test.ts` · AC-10: `levels.test.ts`
