# Verify: Core study loop · spec 0004 · updated 2026-11-02
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run the app in Expo Go (see `docs/references/android-emulator.md`). For a fresh database, clear Expo Go's storage or reinstall it. The first lesson batch is the five level 1 radicals 日 一 王 囗 丶, named sun, plank, monarch, corral, speck.

## Commands
- [ ] `npm run pipeline:download` with `HTTPS_PROXY` set → all 9 files fetched into `pipeline/raw/`, `SOURCES.json` lists url, origin, downloadedAt, sha256, license for each → AC-1
- [ ] `npm run pipeline:download` again → every file says `skip`; with `-- --force` they are fetched again → AC-1
- [ ] `pipeline/raw/SOURCES.json` has `tanosLicense: "usable"` and the CC BY text; `pipeline/src/sources.ts` has the same → AC-2
- [ ] Set `tanosLicense` to `"unconfirmed"` in `sources.ts`, run `npm run pipeline:build` → the report's first line says the KANJIDIC2 fallback is used; set it back to `"usable"` → AC-2
- [ ] `npm run pipeline:build` → `content/subjects.json` written; report shows 25 levels (202 radicals, 612 kanji, 1564 vocab), dropped vocab grouped by reason, and the Noto Sans JP glyph line → AC-3
- [ ] Run `npm run pipeline:build` twice and diff `content/subjects.json` → no id changes → AC-3
- [ ] `npm run pipeline:bundle` → `bundle.json` (135 subjects, level 1) and `content-version.txt` written → AC-4
- [ ] Delete one vocab entry from `content/mnemonics/vocab.json`, run `npm run pipeline:bundle` → refused, names the subject; remove a radical name from a kanji story in `kanji.json` → refused, names the missing radical; restore both → AC-4
- [ ] `npm test` → all pass, including the loop test in `src/lib/study/loop.test.ts` and the bundle hash check → AC-14

## UI / manual
- [ ] Fresh install, open the app → Home shows Lessons 35 and Reviews 0, Start reviews disabled → AC-5, AC-12
- [ ] Close and reopen the app → counts unchanged (no second reseed) → AC-5
- [ ] Tap Start lessons → item 1 of 5 is 日 (sun) with its mnemonic; Back is disabled on page 1; Next pages through all 5; the last button says Start quiz → AC-6
- [ ] Back arrow on a lesson page (before the quiz) → goes Home with no question → AC-11
- [ ] In the quiz, type a wrong name and press enter → field turns red, "Not quite" and the accepted name show; enter again → next question; that question comes back at the end → AC-7, AC-10
- [ ] After one answer, press Android back → "Leave this session?" dialog; Keep going stays; Leave goes Home → AC-11
- [ ] Finish the quiz → "Done, 5 items" with a Home button; Home shows Lessons 30, Reviews 0; leaving the done screen asks nothing → AC-7, AC-11, AC-12
- [ ] Developer card → Debug clock → +4 hours → back to Home → Reviews 5 → AC-13, AC-12
- [ ] Start reviews → header shows "5 left" and counts down as items finish; answer all → "Done, 5 items"; Home shows Reviews 0 → AC-8, AC-10
- [ ] Debug clock +8 hours → Home shows Reviews 5 again (stage 2 interval is 8 hours) → AC-8
- [ ] Debug clock Reset → offset 0; reopen the app after a +4 hours offset → the offset is still applied (saved in `app_meta`) → AC-13
- [ ] On a real phone, the soft keyboard opens on each question and its enter key checks, then moves on → AC-10
- [ ] Reading question (needs a kanji or vocab at stage 0, which arrives once 0006 adds unlocks): typing `jou` shows `じょう`; a capital letter does not give katakana → AC-10
- [ ] Error path: start a quiz, then on a second device or via Fast Refresh restart the quiz after its items are saved; answering one shows the toast "That lesson was already done, so it was skipped." and the count drops → AC-9

## Value sourcing
- [ ] Startup: change one mnemonic, rerun `pipeline:bundle`, reload → the lesson page shows the new text and progress is unchanged (stored version differs from bundled version) → AC-5
- [ ] First launch unlock set: only level 1 radicals unlock (no level 1 kanji has zero radicals today) → AC-5
- [ ] Lesson batch size comes from `user_settings.lesson_batch_size` (default 5): the first batch has exactly 5 items → AC-6
- [ ] `available_at` after a lesson is rounded down to the hour: do lessons at hh:59, add 4 hours minus 1 minute → nothing due until the hour turns → AC-7
- [ ] Review wrong counts: answer one item wrong twice, then right → it stays at stage 1 (not stage 2), and its `reviews` row has incorrect_meaning_count 2 → AC-8
- [ ] Review id is a new UUID per review (check two rows differ) → AC-8
- [ ] Debug clock in a `preview` build redirects to Home (Release build checks) → AC-13
- [ ] Maestro: `maestro test maestro/core-loop.yaml` on the `e2e` APK passes (Release build checks) → AC-15

## Acceptance-criteria coverage
- AC-1 … Commands 1, 2 · AC-2 … Commands 3, 4 · AC-3 … Commands 5, 6 · AC-4 … Commands 7, 8
- AC-5 … UI 1, 2; Value sourcing 1, 2 · AC-6 … UI 3; Value sourcing 3 · AC-7 … UI 5, 7; Value sourcing 4
- AC-8 … UI 9, 10; Value sourcing 5, 6 · AC-9 … UI 14 (and the service error tests in `loop.test.ts`)
- AC-10 … UI 5, 9, 12, 13 · AC-11 … UI 4, 6, 7 · AC-12 … UI 1, 7, 8 · AC-13 … UI 8, 11; Value sourcing 7
- AC-14 … Commands 9 · AC-15 … Value sourcing 8 (release)
