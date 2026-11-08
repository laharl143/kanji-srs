# src/components/subject

The pieces of the item page (`src/app/subjects/[id].tsx`) and the level browser (`src/app/(tabs)/levels.tsx`, `src/app/levels/[n].tsx`). Governing spec: [0009 item pages and level browser](../../../docs/specs/0009-item-pages-and-levels/index.md). Built on the base kit in `../ui/` (see its AGENTS.md); data comes from `@/lib/study/items` and `@/lib/study/levels`.

## Files

Import from the barrel `@/components/subject` (`index.ts`).

- `ItemHero.tsx`: the hero band in the type color (type label and level, characters, primary meaning) and `StageStrip` (stage label from `stageGroup` plus the next review text).
- `next-review-label.ts`: `nextReviewLabel` (AC-3): Locked, Lesson ready, Retired, Now, "in N min", "in N h", then "Tomorrow 2 PM", "Wed 2 PM", "Nov 20". Hours use `localHour` from `../home/forecast-label.ts`; the caller passes `now()` from `@/lib/clock`.
- `Section.tsx`: `Section` card, `Mnemonic`, `NoteText`, and `Readings` (primary readings highlighted). Shared with the lesson page and the quiz's Show details.
- `NoteField.tsx`: a note edited in place (AC-4): "Add meaning note" or tap the note, Save and Cancel, the "N / 1000" counter past 900. Its open text survives a page reload on focus.
- `SynonymEditor.tsx`: synonym chips with a remove button, a field, and Add (AC-5). The refusal reason shows under the field; a failed save keeps your text or chip (AC-6).
- `SubjectTile.tsx`: one level grid tile (5 per row for radicals and kanji, 3 for vocab) with a stage group bar, grey with no bar when locked, and `StageLegend` (the seven states).
- `SpeakButton.tsx`: plays a vocab reading with `expo-speech` (AC-10). Hidden until a Japanese voice is found; tapping restarts, leaving the screen stops it.
- `japanese-voice.ts` (pure) and `use-japanese-voice.ts`: `findJapaneseVoice` prefers an on device `ja` voice over Android's `-network` ones (silent offline). `startJapaneseVoiceCheck` runs once at launch from `src/app/_layout.tsx` and is cached.
- `LoadError.tsx` and `NotFound.tsx`: the error card with "Try again" and the "Not found" message with Back.

## Rules

- Route params go through `parsePositiveParam` in `@/lib/params` (`/^[1-9]\d{0,8}$/`); anything else is Not found (AC-11).
- Screens load from local queries every time they come into view (`useFocusEffect`); a note that is open for editing must not reset on that reload.
- Tile and chip accessibility labels follow `SubjectChip`'s format ("kanji 大, large, Sprout"); scripted checks read them from the screen dump. Width and color classes stay full literal strings (NativeWind cannot read class names built at runtime).
- Every touch target is at least 48dp (`min-h-12`, `h-12 w-12`), which relies on `inlineRem: 16` in `metro.config.js`. Tile text caps its font scale at 1.2 (`maxFontSizeMultiplier`).
- `testID`s here (`speak-reading`, `tile-<id>`) are for scripted checks.

_Drafted by /sync from the introducing change, worth a quick human pass._
