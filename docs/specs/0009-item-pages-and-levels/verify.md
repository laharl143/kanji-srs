# Verify: item pages & level browser · spec 0009 · updated 2026-11-08
_Steps derived from spec 0009 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Already seen on the emulator during /develop (2026-11-08, read from the accessibility tree, because screenshots came back blank): the Levels tab rows and stage tiles, the level 1 page tiles and labels, the 大人 item page with the Play button, adding "big guy", and "Grown up" refused as "Already accepted". Run them again here anyway.

## UI / manual
- [x] Open `/subjects/70` (大人): hero says "VOCABULARY · LEVEL 1", 大人, adult; stage strip shows the stage and next review; Meaning card has "Also accepted: grown-up", the mnemonic, "Add meaning note", and Your synonyms; Reading card has おとな highlighted; "Kanji in this word" lists chips with stage dots → AC-1
- [x] Open a radical page (`/subjects/10`, 大): no Reading card; "Used in (N)" lists kanji in level, then type, then position order. A vocab page has no Used in card → AC-1, AC-2
- [ ] Debug clock: an item due in 30 min reads "in 30 min"; 5 h reads "in 5 h"; a stage 0 item reads "Lesson ready"; a locked item reads "Locked"; a retired one reads "Retired"; an item due tomorrow afternoon, more than 24 h away, reads "Tomorrow 2 PM" style; next week reads "Wed 2 PM" style; further out reads "Nov 20" style → AC-3
- [ ] Next review text in another time zone: set the emulator to a zone where the next due time crosses midnight and check "Tomorrow" versus the weekday label follows the device's local day → AC-3 (Value sourcing: device time zone)
- [x] Tap "Add meaning note", type, Save → the note shows in the card; tap it, clear the text, Save → "Add meaning note" again; edit and Cancel → the old text is back. Type past 900 characters → the "N / 1000" counter shows, and typing stops at 1000 → AC-4
- [x] With a note open for editing, switch to another tab and back → the open field keeps your text → AC-4
- [x] Notes on a locked item (a level 3 item) save and show after reopening → AC-4
- [ ] Synonyms: add "huge" on 大 (kanji) → chip appears, field clears; add "Large " → "Already accepted"; add おおきい → "Type an English meaning"; add "!!!" → "Type an English meaning"; 65 characters → "Use 64 characters or fewer"; a ninth → "You can add up to 8 synonyms"; remove a chip → it disappears → AC-5
- [ ] Start a review of the kanji 大 after adding "huge": answering "huge" is Correct; "hug" is wrong → AC-5 (also runs 0007 AC-11 and AC-12)
- [x] Save failure: not reachable in the UI without breaking the DB; covered by the unit test (`saveNote` throws → nothing written) and by reading `src/app/subjects/[id].tsx` (toast "Could not save. Try again.", the field stays open, the synonym text stays, a removed chip stays) → AC-6
- [x] Lesson page of an item with notes: your meaning note shows under the meaning mnemonic, your reading note under the reading mnemonic, and synonyms after "Also accepted" → AC-7
- [ ] Review: answer wrong → "Not quite" card shows "Show details" (collapsed); tap → the mnemonic and your note for that kind; the next wrong answer starts collapsed again. A radical's meaning has a mnemonic, so the toggle shows → AC-7
- [ ] Edit a note during a review session (back out to the item page) → the open session still shows the old note; the next session shows the new one → AC-7
- [x] Levels tab: five stage tiles match Home's Stages card exactly; one row per level with "X / Y kanji" and a bar; a "Current" badge on your level; levels above are greyed with "Locked" but open on tap → AC-8 (also runs 0008 AC-4)
- [x] `/levels/1`: Radicals, Kanji, Vocabulary with "X/Y passed"; tiles 5 per row (radicals, kanji) and 3 per row (vocab); a stage bar along the bottom of each tile; grey tiles for items with no assignment; the legend shows Locked, Lesson, Seed, Sprout, Bloom, Harvest, Retired; tap a tile → its item page → AC-9
- [x] TalkBack or the screen dump reads a tile as "kanji 三, three, Seed" style → AC-9
- [ ] Vocab item page and vocab lesson page: Play button beside the readings speaks おとな for 大人; tap again while speaking → restarts; leave the screen → stops. On an emulator with no Japanese voice, there is no button → AC-10
- [x] `/subjects/abc`, `/subjects/1.5`, `/subjects/0`, `/subjects/007`, `/subjects/999999`, `/levels/abc`, `/levels/99` → "Not found" with a Back button; nothing crashes → AC-11
- [x] At 360dp (`adb shell wm density 480`) and font scale 1.3, in light and dark: the item page, the Levels tab, and a level page read cleanly; every button, chip, and tile is at least 48dp; undo both settings after → AC-12

## Commands
- [x] `npm test` → all pass, including `src/lib/study/items.test.ts`, `levels.test.ts`, `src/lib/answer/synonym.test.ts`, `src/lib/params.test.ts`, `src/components/subject/next-review-label.test.ts`, `japanese-voice.test.ts`, `src/components/study/quiz-details.test.ts`, and the Home dashboard tests (unchanged output after the `countStageGroups` extraction) → AC-3, AC-5, AC-7, AC-8, AC-9, AC-11
- [x] `npm run typecheck` and `npm run lint` → clean → AC-12

## Acceptance-criteria coverage
- AC-1 item page steps 1 and 2 · AC-2 step 2 · AC-3 steps 3 and 4, unit tests · AC-4 steps 5 to 7 · AC-5 steps 8 and 9, unit tests · AC-6 step 10 · AC-7 steps 11 to 13, unit tests · AC-8 step 14, unit tests · AC-9 steps 15 and 16, unit tests · AC-10 step 17 · AC-11 step 18, unit tests · AC-12 step 19, commands
