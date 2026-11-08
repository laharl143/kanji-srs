# Verify: answer checking · spec 0007 · updated 2026-11-08
_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

Run on the emulator (see `docs/references/android-emulator.md`) in a review or lesson quiz. Typing through `adb shell input text` only sends ASCII, so the Japanese script meaning case is covered by Vitest.

- [x] Meaning question: type the meaning in capitals with a trailing "!" (for 人, "WALKER!") → Correct → AC-1
- [x] Meaning question: type a one letter typo (人: "walkr") → green field, "Close enough", "Answer: walker" (`answer-close`) → AC-2, AC-9 (passed 2026-11-08 after the Gboard fix, submitted with Enter: 三 "thre" → "Close enough", "Answer: three"; 人 was not due)
- [x] Meaning question: type a swap typo (時: "tiem") → "Close enough", "Answer: time" → AC-2, AC-9 (passed 2026-11-08 after the Gboard fix, submitted with Enter: 一日 "one dya" stayed as typed → green field, "Close enough", "Answer: one day"; 時 was not due)
- [x] Press Next after "Close enough" → the item finishes like a right answer: "N left" drops by one and accuracy does not fall → AC-9
- [x] Meaning question for 三: type "tree" → "Not quite" (another course word), while "thre" → "Close enough" → AC-3
- [x] Kanji reading question with on'yomi primary (後 or 時): type its kun'yomi (`ato` / `toki`) → field shakes, "Looking for the on'yomi" (`answer-hint`), text stays as kana, "N left" and accuracy unchanged → AC-5, AC-7
- [x] Reading question: type `x` and submit → shake and "Type the reading in kana" → AC-6
- [x] With a hint showing, press backspace → the hint goes away; submit with an empty field → nothing happens → AC-7, AC-10
- [x] Submit the same wrong kind answer twice → the field shakes each time and TalkBack reads the hint each time → AC-8 (passed 2026-11-08 on 下 `shita`: TalkBack spoke "Looking for the on'yomi" and started a new utterance on every repeat; the field moved 13, 12 and 13 px on three repeats, and "N left" and accuracy did not change)
- [x] Turn on remove animations (`adb shell settings put global animator_duration_scale 0` plus the transition and window scales) → submit a wrong kind answer → the field does not move, the hint still shows; turn animations back on → AC-8
- [x] Meaning question: type only "?!" and submit → nothing happens (no check, no shake, no hint) → AC-10
- [x] Vocab reading question for 日本: type `nihon` → Correct → AC-4 (passed 2026-11-08 in a lesson quiz: にほん, Correct)
- [x] After a wrong reading on a vocab item with several readings → the accepted list shows the primary reading first, then the rest → AC-11
- [x] Reading question before checking → helper line reads "Romaji turns into kana as you type. Press enter to check."; meaning question → "Press the keyboard's enter key to check." → AC-13
- [x] Repeat the hint and "Close enough" checks in dark mode at 360dp (`adb shell wm density 480`) with font scale 1.3; nothing clips; undo both afterwards → AC-8, AC-9, AC-13

## Value sourcing

- [ ] Accepted forms come from the subject's meanings plus your synonyms: add a synonym with `upsertNote` (or the feature 10 editor once it exists), start a new session, type it → Correct; type it with one typo → "Close enough" naming the synonym → AC-1, AC-12
- [x] Course forms come from every subject's meanings: a meaning that exists only on another level's subject still blocks a typo match (Vitest builds the guard from `content/bundle.json`) → AC-3
- [x] Tolerance follows the accepted form's length, not the input's: "fuur" is close for "four", "fuux" is wrong → AC-2
- [x] `expected` is the original text of the nearest meaning (brackets and capitals kept), not the normalized form → AC-2, AC-9
- [x] Accepted readings: kanji uses primary readings only (a kun'yomi gives the hint, never Correct); vocab uses every reading → AC-4, AC-5
- [x] Wrong kind `wanted` comes from the kind of the primary readings (all on'yomi in the current bundle, so the hint says "on'yomi") → AC-5
- [x] Invalid hint text follows `wanted`: kana for readings, English for meanings → AC-6
- [ ] Accepted answers list after a wrong meaning: meanings, then your synonyms → AC-11
- [x] Shake follows the system's remove animations setting, read live → AC-8
- [x] Helper line text follows the question kind → AC-13
- [x] Load failure: make `loadCourseForms` throw (for example, a temporary `throw` in `src/lib/study/answers.ts`) → Reviews and Lessons both show the error card with "Try again"; remove the throw and press "Try again" → the session loads → AC-12 (passed 2026-11-08 in a throwaway worktree, with a throw on the first call only: "Reviews could not load" and "Lessons could not load" with "Try again"; "Try again" then loaded 41 reviews and a lesson batch)

## Commands

- [x] `npx vitest run src/lib/answer src/components/study/answer-state.test.ts` → all pass (normalization, tolerance boundaries 3/4/5/6/9/10/13, digit rule, course guard on the real bundle, kana normalization, wrong kind, invalid, accepted lists, hook state rules) → AC-1 to AC-7, AC-9 to AC-11
- [x] `npx vitest run src/lib/db/queries src/lib/study/loop.test.ts` → `getSynonyms`, `getAllMeanings`, loaders attach synonyms, `loadCourseForms` → AC-3, AC-12
- [x] `npm run typecheck` and `npm run lint` → clean

## Acceptance-criteria coverage

- AC-1 normalization steps and the Commands step · AC-2 typo and swap steps · AC-3 the 三 "tree" step and Vitest · AC-4 日本 step · AC-5 wrong kind step · AC-6 `x` step and Vitest (Japanese in the meaning field) · AC-7 hint and backspace steps · AC-8 shake and remove animations steps · AC-9 close and Next steps · AC-10 "?!" and empty steps · AC-11 accepted list steps · AC-12 synonym and load failure steps · AC-13 helper line step
- Emulator pass on 2026-11-08 (by /develop): AC-5, AC-6 (kana), AC-7, AC-8 (shake moved the field 10 px; no movement with remove animations), AC-9 (close counted, "N left" dropped and accuracy stayed 100%), AC-13, all in light and in dark at 360dp with font scale 1.3.
