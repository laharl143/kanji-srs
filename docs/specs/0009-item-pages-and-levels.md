# 0009. Item pages, notes, and level browser

**Date**: 2026-10-13
**Status**: In Progress

## Summary

Every radical, kanji, and vocab gets its own page with full details, where it is used, and your own notes and synonyms. A level browser shows every item in a level colored by its stage. Vocab pages have a play button that speaks the word.

## Requirements

**Acceptance criteria**:
- **AC-1**: `/subjects/[id]` shows characters, type, level, meanings, readings, components (as `SubjectChip`s), mnemonics, SRS stage name, and next review time (or "Locked").
- **AC-2**: A "Used in" section lists subjects whose `component_ids` include this one.
- **AC-3**: You can edit a meaning note, a reading note, and synonyms (add / remove); saved through a server action; synonyms are used by `checkMeaning` (0007).
- **AC-4**: Your notes show under the mnemonics on item pages, in lessons, and in the review details panel.
- **AC-5**: `/levels` lists levels 1 to N with progress; `/levels/[n]` shows radicals, kanji, vocab grids colored by stage group (locked items greyed).
- **AC-6**: Vocab pages and lessons have a play button using `speechSynthesis` with a `ja-JP` voice; hidden when unavailable (0001 §9).
- **AC-7**: Unknown id or level returns the Next.js not found page.

## Decision

**Chosen option**: server component pages using existing queries; notes via `upsertNote` server action; speech in a small client component `SpeakButton`.

## Feature design

**Critical test scenarios**:
- Add a synonym on a kanji page, then that synonym is accepted in a review, verifies **AC-3**
- `/subjects/999999` → not found, verifies **AC-7**

## Build plan

1. `/subjects/[id]` page with details and used-in, satisfies **AC-1**, **AC-2**, **AC-7**
2. Notes and synonyms editor + action, satisfies **AC-3**
3. Show notes in lessons and review details, satisfies **AC-4**
4. `/levels` and `/levels/[n]`, satisfies **AC-5**, **AC-7**
5. `SpeakButton` component, satisfies **AC-6**

## Consequences

**Positive**: you can fix any mnemonic you dislike with your own note.
**Negative / tradeoffs**: browser voices vary by OS; VOICEVOX files are a deferred upgrade.
