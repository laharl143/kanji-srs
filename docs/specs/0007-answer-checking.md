# 0007. Answer checking rules

**Date**: 2026-10-13
**Status**: In Progress

## Summary

Makes answers forgiving in the right places: small typos in meanings are accepted, your own synonyms count, katakana is treated like hiragana, and typing the wrong kind of kanji reading gives a hint instead of a penalty. Rules from 0001 §7.

## Requirements

**Acceptance criteria**:
- **AC-1**: `checkMeaning` normalizes (lowercase, trim, collapse spaces, strip punctuation) and returns `correct` for exact matches against meanings and user synonyms.
- **AC-2**: `checkMeaning` returns `close` (accepted) when Levenshtein distance is within: 0 for length ≤ 3, 1 for 4 to 5, 2 for 6 to 9, `floor(len / 4)` above; otherwise `wrong`.
- **AC-3**: `checkReading` converts katakana to hiragana before comparing.
- **AC-4**: For kanji, a reading of the other kind returns `wrong_kind` with the wanted kind; the UI shakes, shows "Looking for the on'yomi" (or kun'yomi), and does not count it wrong.
- **AC-5**: A reading answer still containing romaji letters returns `invalid`; the UI shakes and does not count it wrong.
- **AC-6**: `close` answers show "Close enough" with the right spelling.
- **AC-7**: Empty input does nothing.

## Decision

**Chosen option**: pure functions in `src/lib/answer/`, a small in-repo Levenshtein (no dependency), `wanakana.toHiragana` / `isRomaji` for kana handling.

## Feature design

```ts
type AnswerResult =
  | { result: "correct" | "close" | "wrong" | "invalid" }
  | { result: "wrong_kind"; wanted: "onyomi" | "kunyomi" };
checkMeaning(input: string, meanings: Meaning[], synonyms: string[]): AnswerResult
checkReading(input: string, subject: { type: SubjectType; readings: Reading[] }): AnswerResult
```
For kanji, "accepted" readings are those with `primary: true`; the other kind is the non-primary kind.

**Critical test scenarios**:
- Threshold boundaries for lengths 3, 4, 5, 6, 9, 10, 13, verifies **AC-2**
- `キュウ` accepted for `きゅう`, verifies **AC-3**
- Kun'yomi typed for on'yomi-primary kanji → `wrong_kind`, verifies **AC-4**
- `kyu` left unconverted → `invalid`, verifies **AC-5**

## Build plan

1. Normalizer and Levenshtein with tests, satisfies **AC-1**, **AC-2**
2. `checkReading` with kana normalization, wrong kind, invalid; tests, satisfies **AC-3** to **AC-5**
3. Wire results into the review and lesson quiz UI (shake, hints, close enough, ignore empty), satisfies **AC-4** to **AC-7**

## Consequences

**Positive**: fewer unfair misses, so SRS stages reflect real knowledge.
**Negative / tradeoffs**: typo tolerance can occasionally accept a different real word; you can always mark items via notes later.
