# 0006. SRS progression: unlocks, level up, wrap up

**Date**: 2026-10-13
**Status**: In Progress

## Summary

Thickens the SRS part of the loop: kanji unlock when their radicals pass, vocab unlocks when its kanji pass, you level up at 90% of a level's kanji passed, and reviews get a wrap up button and an end summary. All rules from 0001 §6, kept as pure tested functions.

## Requirements

**Acceptance criteria**:
- **AC-1**: `computeUnlocks(subjects, assignments, currentLevel, now)` returns new stage 0 assignments for kanji whose radicals are all passed and vocab whose kanji are all passed, only at or below `currentLevel`.
- **AC-2**: `checkLevelUp(subjects, assignments, currentLevel)` returns the next level when ≥ 90% of the current level's kanji are passed (exactly 90% counts).
- **AC-3**: On level up, the next level's radicals unlock, plus kanji whose radicals are already all passed.
- **AC-4**: `applyReview` sets `passed_at` the first time stage reaches 5 and `burned_at` at stage 9; it never clears `passed_at`.
- **AC-5**: After every `submitReview`, the server runs unlocks and level up inside one transaction.
- **AC-6**: Reviews have a Wrap up button: no new items start, started items finish; an end summary shows correct, incorrect, and stage changes per item.
- **AC-7**: Lessons are ordered lowest level first, then radicals, kanji, vocab, then `position`.

## Decision

**Chosen option**: pure functions in `src/lib/srs/unlock.ts` and `src/lib/srs/level.ts`; one server-side `afterReview(userId, now)` routine calls them and writes changes.

## Feature design

**State transitions** (assignment): none → 0 (unlock) → 1 (lesson) → 1..8 (reviews) → 9 (retired).

**Critical test scenarios**:
- Kanji with 2 radicals: one passed → locked; both passed → unlocked, verifies **AC-1**
- Level with 25 kanji: 22 passed → no level up; 23 passed (92%) → level up; level with 10 kanji, 9 passed (90%) → level up, verifies **AC-2**
- Stage 4 → 5 sets `passed_at`; drop to 3 keeps it, verifies **AC-4**
- Playwright: wrap up mid-session leaves unstarted items due, verifies **AC-6**

## Build plan

1. `unlock.ts` + tests, satisfies **AC-1**
2. `level.ts` + tests, satisfies **AC-2**, **AC-3**
3. Extend `applyReview` for `passed_at` / `burned_at` + tests, satisfies **AC-4**
4. `afterReview` server routine in a transaction, wired into `submitReview`, satisfies **AC-5**
5. Wrap up button and summary screen in `/reviews`, satisfies **AC-6**
6. Lesson ordering in `getLessonQueue`, satisfies **AC-7**

## Consequences

**Positive**: the course now advances on its own through all enabled levels.
**Negative / tradeoffs**: unlocking past the last enabled level waits until more mnemonics are written (feature 12, Mnemonic waves, in the scope).
