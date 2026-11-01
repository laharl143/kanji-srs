# 0010. Settings and credits

**Date**: 2026-10-13
**Status**: In Progress

## Summary

A settings page for lesson batch size, skipping ahead if you already know some kanji, and resetting progress. A credits page names the open data sources and their licenses, which those licenses require.

## Requirements

**Acceptance criteria**:
- **AC-1**: `/settings` edits `lesson_batch_size` (3 to 20); lessons use it.
- **AC-2**: Skip ahead to level N (2 to highest enabled level), behind a `ConfirmDialog`: every subject below level N becomes stage 9 with `burned_at` = now (no review rows), `current_level` = N, and level N unlocks as at start (0001 §6.4).
- **AC-3**: Reset progress, behind a `ConfirmDialog` that asks you to type `RESET`: deletes the user's assignments, reviews, and settings (notes are kept), then unlocks level 1 again.
- **AC-4**: `/credits` lists KANJIDIC2, JMdict, KRADFILE (EDRDG, CC BY-SA 4.0, with links), the JLPT list source and its license from `pipeline/raw/SOURCES.json`, and VOICEVOX if audio was added.
- **AC-5**: A footer link to Credits on every page.

## Decision

**Chosen option**: server actions `updateSettings`, `skipToLevel(n)`, `resetProgress()`; skip and reset run in one transaction each. `skipToLevel` logic is a pure function `planSkip(subjects, assignments, n, now)` in `src/lib/srs/skip.ts`.

## Feature design

**Critical test scenarios**:
- `planSkip` to level 3 retires all level 1 and 2 subjects and unlocks level 3 radicals, verifies **AC-2**
- Reset keeps notes and leaves level 1 radicals at stage 0, verifies **AC-3**

## Build plan

1. Settings form + `updateSettings`, satisfies **AC-1**
2. `planSkip` + tests, `skipToLevel` action + dialog, satisfies **AC-2**
3. `resetProgress` action + typed confirm, satisfies **AC-3**
4. `/credits` page + footer link, satisfies **AC-4**, **AC-5**

## Consequences

**Positive**: you can start at the right level and meet the license terms.
**Negative / tradeoffs**: reset cannot be undone (hence the typed confirmation).
