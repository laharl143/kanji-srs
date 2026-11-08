# 0009 rationale: item pages, notes, and level browser

Decision record for [index.md](index.md). `/develop` builds from `index.md` and can skip this file.

## Context

The app is an offline Expo Android app (spec 0001). The first version of this spec planned Next.js server components and a server action; none of that exists any more. Today `src/app/subjects/[id].tsx` and the Levels tab are placeholders, while `SubjectChip` already links every chip to `/subjects/[id]`, so a tap on a component in a lesson lands on an empty page.

The data is already in place. Spec 0002 created `user_notes` (meaning note, reading note, synonyms as a JSON list, `updated_at`), and `src/lib/db/queries/notes.ts` has `getNote`, `upsertNote`, and `getSynonyms`. Spec 0007 wired synonyms into answer checking: the lesson quiz and reviews load them at session start and accept them, but nothing lets you add one. Two verify steps wait on that (0007 AC-11 and AC-12), and the dashboard check for stage counts (0008 AC-4) waits on a Levels screen to compare against.

Forces: a phone screen at 360dp and font scale 1.3; Japanese text in Noto Sans JP; the type colors (radical blue, kanji pink, vocab purple) used on every screen so far; stage group colors from `src/theme/stage.ts`, some of which fail contrast as a background behind white text; levels of up to about 135 items (level 1: 35 radicals, 25 kanji, 75 vocab); ground rules 5 and 6 (pure answer module, no app writes to content tables); and an Android text to speech engine that may or may not have a Japanese voice.

## Options considered

Each decision was drawn as phone mockups on 2026-11-08 and picked by you.

### Item page layout
- **A. Notes inside each card (chosen)**: hero, stage strip, Meaning card with your note and synonyms, Reading card with your note, components, Used in. Pros: your note is right under the mnemonic it replaces, as in lessons; stage visible without scrolling. Cons: a longer page when both notes are filled.
- **B. One "Your notes" card**: all your text in one card near the bottom. Pros: one place for your own text. Cons: the note is far from the mnemonic; stage at the very bottom.
- **C. Tabs (Info, Notes, Used in)**: Pros: short screens. Cons: hides notes behind a tap; a new tab component to build and test.

### Editing notes and synonyms
- **A. Edit in place (chosen)**: Save and Cancel inside the card; synonyms save on add or remove. Pros: you see the mnemonic while writing; Cancel backs out. Cons: the keyboard covers lower cards, so the screen must scroll the field into view.
- **B. Edit sheet with one Save**: Pros: one save. Cons: hides the mnemonic; comma separated synonyms are error prone.
- **C. Autosave**: Pros: fewest taps. Cons: no way to back out; more write paths.

### Levels tab
- **A. Level rows with progress (chosen)**, plus **a stage tile row on top (chosen, decision 9)**. Pros: the same numbers as Home's Level and Stages cards, so 0008 can be checked; a plain list scales to about 26 levels. Cons: less visual than a grid; repeats Home's stage tiles.
- **B. Grid of level numbers**: compact, but no progress without opening a level.
- **C. Open on the current level with arrows**: one tap to what you study, but no overview.

### Level page tiles
- **A. Type color with a stage bar (chosen)**: Pros: keeps the type colors used everywhere; stage readable at a glance with a legend. Cons: the bar is a thin stripe, so the TalkBack label carries the stage too.
- **B. Stage colored tiles**: strongest stage signal, but loses type colors, and Sprout and Bloom backgrounds fail contrast with white text.
- **C. Plain `SubjectChip` with the stage dot**: no new component, but no meaning on the tile and an 8dp dot is hard to read.

### Notes in a review after a wrong answer
- **A. "Show details" expands inline (chosen)**: mnemonic and your note for the missed kind, no navigation. Cons: read only there.
- **B. "Open item" link**: full page and editable, but a synonym added mid session would not count until the next session, which looks like a bug.
- **C. Note always in the wrong card**: zero taps, but no mnemonic, and nothing for items without a note.

### Speak button, synonym rules, locked items, levels above yours
- Speak on vocab item pages and lessons only (chosen) over also in reviews: matches the scope and 0001 §8; one less screen to verify.
- Light synonym limits (chosen) over anything non blank: no duplicates in the accepted answers list (0007 AC-11), no runaway list.
- Full page for locked items with editable notes (chosen) over a teaser page: one code path, and you can prepare notes ahead.
- Levels above yours greyed but tappable (chosen) over not tappable: consistent with full locked item pages.

## Rationale

The layout follows what the app already does. The lesson page already shows a hero band and Meaning and Reading cards with mnemonics, so the item page reuses those pieces and adds your text where it belongs: under the mnemonic it overrides. Editing in place keeps the mnemonic in view, and Save and Cancel give a clear way back, which autosave does not. Synonyms are different from notes: each one is a small atomic change, so saving on add or remove is safe and reads naturally, and doing the read and write in one transaction keeps two quick taps from losing one.

The level browser leans on numbers the dashboard already computes. Extracting `countStageGroups` from `getDashboard` and using it on the Levels tab means the two screens agree by construction, which is exactly what the 0008 check asks for. Type colored tiles with a stage bar keep the one color language the app has used since spec 0003, while the bar and legend answer "colored by stage" without the contrast problems of stage colored backgrounds.

Mnemonics and notes for "Show details" are loaded with the session rather than on tap, so a review never waits on or fails a load halfway through, matching how 0007 loads synonyms. The speak button speaks the primary reading in kana rather than the kanji, because a text to speech engine can pick the wrong reading for kanji on its own; the kana is the reading the quiz accepts.

Small calls I made: a 1000 character note limit (generous, keeps the page sane; runner up: no limit); 64 characters and 8 synonyms (enough for real use; runner up: 100 and 10); compare synonyms through `meaningForms`, the same forms the checker accepts, so a synonym the checker would already accept is refused as a duplicate (a cross check on 2026-11-08 caught that a plain `normalizeMeaning` compare misses "run" against "to run"); refuse Japanese script synonyms, which the meaning field never matches; a 5 column grid for radicals and kanji and 3 for vocab at 360dp, since vocab like 出かける needs the width, with tile text capped at 1.2 font scale; `/levels/[n]` on the root stack, which does not clash with the tab route because route groups are transparent.
