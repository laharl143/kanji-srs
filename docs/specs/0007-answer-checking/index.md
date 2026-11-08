# 0007. Answer checking rules

**Date**: 2026-10-13 (updated for Android and the built core loop on 2026-11-08)
**Status**: Accepted

## Summary

This spec makes answers forgiving in the right places. Small meaning typos are accepted as "close enough", brackets and a leading "to" are optional, your own synonyms count, katakana counts as hiragana, and vocab accepts every listed reading. Answers that are the wrong kind of input (a kun'yomi when the on'yomi is wanted, romaji left in the reading field, Japanese in the meaning field) shake the field with a hint and do not count against you. A typo never passes when what you typed is another item's meaning, so "tree" is still wrong for 三 (three). Everything lives in pure functions in `src/lib/answer/`, and the screens only learn a few new result kinds.

The decision history (context, options considered, rationale) is in [rationale.md](rationale.md). Verify steps are in [verify.md](verify.md).

## Requirements

**User stories**:
- As a learner, I want a small meaning typo accepted so that one slip does not drop an item I know.
- As a learner, I want a typo that spells a different course word marked wrong so that real confusions still cost me.
- As a learner, I want a hint instead of a penalty when I type the wrong kind of reading or the wrong script so that I can fix it and answer properly.
- As a learner, I want every real reading of a word accepted so that にほん counts for 日本.

**Acceptance criteria**:
- **AC-1**: `checkMeaning` builds forms in this order. From the raw text of each meaning and each of your synonyms: (1) the full text and (2) the text with every bracketed part removed (non greedy `(...)`; an unclosed bracket is left alone); then each of those also without a leading "to ". Every form is then normalized: NFKD (full width letters become plain, accents split off), combining marks dropped, lowercase, hyphens and slashes become spaces, every other character that is not a letter, digit, or space removed, spaces collapsed and trimmed. The input gets the same treatment: itself and itself without a leading "to ", normalized the same way. The answer is `correct` when any input form equals any accepted form. Empty forms are skipped. Digits and number words are never treated as the same: "3" is `wrong` for a meaning of "three".
- **AC-2**: When nothing matches exactly, `checkMeaning` returns `close` with `expected` set to the original text of the nearest meaning or synonym, when the edit distance from an input form to an accepted form is within the tolerance for that accepted form's length: 0 for length 3 or less, 1 for 4 to 5, 2 for 6 to 9, `floor(length / 4)` above. The edit distance is optimal string alignment (Levenshtein, the count of letter inserts, deletes, and swaps, where swapping two neighboring letters also counts as one edit, so "foru" is close for "four"). A close match also needs the digits in both forms to be identical, in order ("30 years old" is never close for "20 years old"). Ties go to the smaller distance, then a primary meaning, then list order (meanings before synonyms). Otherwise it returns `wrong`.
- **AC-3**: A meaning input where either input form (with or without the leading "to ") equals a course form, and that is not an exact match for this subject, is `wrong`, never `close`. Course forms are every form (all four from AC-1) of every subject's meanings in the content tables. Because the exact match for this subject runs first, a meaning that several subjects share still counts as `correct` for each of them.
- **AC-4**: `checkReading` first applies NFKC (half width katakana become full width), then converts to hiragana with wanakana (katakana and the katakana long vowel mark included, so キュー equals きゅう), then replaces each hiragana long vowel mark ー that follows a kana with that kana's vowel (so `kyu-`, which the field turns into きゅー, equals きゅう), and removes spaces. A kanji answer is `correct` when it equals a primary reading; a vocab answer is `correct` when it equals any of its readings.
- **AC-5**: For a kanji, an answer that equals a reading whose kind differs from the primary kind returns `wrong_kind` with `wanted` set to the primary kind. The field shakes, the hint reads "Looking for the on'yomi" (or "Looking for the kun'yomi"), and the answer does not count.
- **AC-6**: A reading answer that still holds anything other than hiragana after AC-4 (romaji letters, kanji, digits, punctuation, or a ー with no kana before it) returns `invalid` with `wanted: "kana"`; the field shakes, the hint reads "Type the reading in kana", and the answer does not count. A meaning answer whose raw text (checked before any normalization) holds hiragana, katakana, half width katakana, the iteration mark 々, or kanji (U+3040 to U+30FF, U+3005, U+4E00 to U+9FFF, U+FF66 to U+FF9F) returns `invalid` with `wanted: "english"`; the hint reads "Type the meaning in English".
- **AC-7**: "Does not count" means: no verdict shows, the question stays, the converted text (after `finishReadingInput`) stays in the field and can be edited, wrong counts and accuracy do not change, and the leave guard is not armed by it alone. Editing the field or moving to another question clears the hint; an `empty` submit leaves an existing hint alone. Submitting again checks again.
- **AC-8**: The shake moves the answer field side to side for about 300 ms. With the system's remove animations setting on, the field does not move, and the hint still shows. The hint has the `answer-hint` test ID, sits in an `accessible` view with an assertive live region, and is mounted again on each shake (keyed by `shakeKey`) so the same hint twice in a row is announced twice.
- **AC-9**: A `close` answer counts as right everywhere (queue, accuracy, SRS stage). The field turns green as for `correct`, its accessibility label ends ", close enough", and the result line reads "Close enough" with "Answer: <expected>" under it, with the `answer-close` test ID. Next clears it.
- **AC-10**: Empty input does nothing, as today. A meaning input with nothing left after normalization (only punctuation) also does nothing: no check, no shake, no hint.
- **AC-11**: After a wrong answer, the accepted answers list shows every meaning followed by your synonyms, or for readings: the primary readings for a kanji, and every reading for a vocab item (primary first).
- **AC-12**: The lesson quiz and the review session both load your synonyms for their items from `user_notes` and accept them (AC-1, AC-2). Synonyms are trimmed and blank ones dropped; an item with no notes row has none. The course forms load at the same time. If either load fails, the screen shows its existing error card with "Try again", never a session with an empty synonym list or an empty course word set.
- **AC-13**: On a reading question, before you check, the helper line under the button reads "Romaji turns into kana as you type. Press enter to check." Meaning questions keep "Press the keyboard's enter key to check."

## Decision

**Chosen option**: Option 2: Thresholds plus a course word guard

Pure checkers in `src/lib/answer/` return a richer `AnswerResult`; the quiz hook turns `close` into a right answer and `wrong_kind` and `invalid` into a shake and a hint; sessions load your synonyms and the course meaning forms alongside their items.

## Feature design

**Data model sketch**: no schema change. Reads `user_notes.synonyms` (existing JSON column) and `subjects.meanings` (existing).

**Pure module** (`src/lib/answer/`):
```ts
// check.ts
export type AnswerResult =
  | { result: "correct" }
  | { result: "close"; expected: string }
  | { result: "wrong" }
  | { result: "wrong_kind"; wanted: "onyomi" | "kunyomi" }
  | { result: "invalid"; wanted: "kana" | "english" }
  | { result: "empty" };

checkMeaning(
  input: string,
  subject: { meanings: Meaning[] },
  synonyms: readonly string[],
  courseForms: ReadonlySet<string>,
): AnswerResult
checkReading(input: string, subject: { type: SubjectType; readings: Reading[] }): AnswerResult
acceptedAnswers(
  kind: "meaning" | "reading",
  subject: { type: SubjectType; meanings: Meaning[]; readings: Reading[] },
  synonyms: readonly string[],
): string[]

// meaning.ts
normalizeMeaning(text: string): string
meaningForms(text: string): string[]       // the up to four forms of AC-1, deduplicated
buildCourseForms(meaningLists: Meaning[][]): Set<string>
tolerance(length: number): number          // the AC-2 table

hasJapaneseScript(text: string): boolean   // the AC-6 ranges, on raw text
digitsOf(text: string): string             // the digits of a normalized form, in order (AC-2)

// distance.ts
editDistance(a: string, b: string): number // optimal string alignment (AC-2)
```
`kana.ts` keeps `toReadingInput` and `finishReadingInput` and gains `normalizeReading(text)` (NFKC, wanakana `toHiragana`, hiragana ー after a kana becomes that kana's vowel, spaces removed) and `isHiraganaOnly(text)` (false for a ー with no kana before it).

Check order, meaning: Japanese script in the raw input → `invalid`; every input form empty → `empty`; any input form equals an accepted form → `correct`; any input form in `courseForms` → `wrong`; nearest accepted form within tolerance with identical digits → `close`; else `wrong`. Reading: empty → `empty`; not hiragana only → `invalid`; matches accepted → `correct`; kanji and matches the other kind → `wrong_kind`; else `wrong`. Radicals have no reading questions.

**Services and data**:
| Function | Where | Inputs | Output |
|---|---|---|---|
| `getSynonyms` | `src/lib/db/queries/notes.ts` | `db, userId` | `Map<number, string[]>`: one query over all of your notes (no `inArray`, so a large review session never hits the SQLite variable limit), trimmed, blanks dropped, empty lists left out |
| `getAllMeanings` | `src/lib/db/queries/subjects.ts` | `db` | `Meaning[][]`, one list per subject |
| `loadCourseForms` | `src/lib/study/answers.ts` (new) | `db` | `ReadonlySet<string>` via `buildCourseForms` |
| `loadLessonBatch`, `loadReviewSession` | existing | unchanged | each `LessonItem` and `ReviewItem` gains `synonyms: string[]` (beside `subject`, not on it: `LessonPage` and `ReviewSummary` keep reading the subject unchanged) |

**UI**:
- `QuizSubject` gains `synonyms`. `LessonQuiz` and `ReviewSession` build `{ ...item.subject, synonyms: item.synonyms }` where they call the hook; `reviews.tsx` keeps passing plain `SubjectSummary[]` to `ReviewSummary`.
- `useQuizSession(subjects, save, { windowSize, courseForms })`, with `courseForms` required.
- Both screens load `loadCourseForms(getDb())` in one `Promise.all` with their session data (`lessons.tsx` gains one around `loadLessonBatch`); the ready state carries `courseForms`. A rejected load lands in the existing error card with "Try again". `keepReviewing` reloads both. No caching across sessions.
- Hook state: `verdict` becomes `"correct" | "close" | "wrong" | null`, plus `hint: string | null`, `closeTo: string | null` (from the result's `expected`), and `shakeKey: number`. On submit with `verdict === null`: compute the answer (`finishReadingInput` for readings) and `setInputState(answer)` in every case, then by result: `empty` changes nothing else; `wrong_kind` and `invalid` set `hint` and bump `shakeKey`, leave `verdict` null and `answeredAny` unchanged; `correct`, `close`, `wrong` set `verdict` (and `closeTo` for close), clear `hint`, and set `answeredAny`. On Next: `answerCurrent(queue, verdict !== "wrong")`, then clear `verdict`, `closeTo`, `hint`, and the input. `setInput` clears `hint` (it already only acts while `verdict` is null).
- `AnswerInput` takes `shakeKey`; a change runs the `Animated` shake unless reduce motion is on. Reduce motion is read once with `AccessibilityInfo.isReduceMotionEnabled()` in an effect and kept current with the `reduceMotionChanged` listener. `AnswerStatus` gains `close`, styled like `correct`, with the ", close enough" label.
- `QuizView` shows the hint under the field (`answer-hint`, in an `accessible` view with `accessibilityLiveRegion="assertive"`, keyed by `shakeKey`), the "Close enough" line (`answer-close`), and the AC-13 helper line.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| check meaning | accepted forms | `subject.meanings` (content) plus `synonyms` from `user_notes` |
| check meaning | course forms | `getAllMeanings` over the content `subjects` table |
| check meaning | tolerance | `tolerance(length)` of the accepted form (AC-2 table) |
| close result | `expected` text | the original `Meaning.text` or synonym string of the nearest form |
| check reading | accepted readings | kanji: `readings` with `primary: true`; vocab: all `readings` |
| wrong kind | `wanted` and hint word | `kind` of the subject's primary readings; "on'yomi" / "kun'yomi" |
| invalid | hint text | `wanted`: "Type the reading in kana" or "Type the meaning in English" |
| wrong answer | accepted answers list | `acceptedAnswers` (AC-11) |
| shake | whether to animate | `AccessibilityInfo.isReduceMotionEnabled()` |
| helper line | text | fixed copy, by question kind (AC-13) |

**Key invariants**:
- `src/lib/answer` stays pure: synonyms and course forms are arguments, never loaded inside.
- Only `correct` and `close` call `answerCurrent(queue, true)`; only `wrong` calls it with `false`; nothing else touches the queue.
- An exact match for this subject always wins over the course word guard.

**Security model**: single local user (spec 0001); synonyms are read for `getCurrentUserId()` only. No new data leaves the phone.

**Critical test scenarios**:
- Normalization: "All Day", "all day long", "ALL-DAY" match "all day (long)"; "go out" and "to go out" both match "to go out (e.g. on an excursion or outing)"; "to one" matches "one" (the input's "to" is optional too); "ritsuryo" matches "ritsuryō", verifies **AC-1**
- "3" is `wrong` for "three"; full width "ｏｎｅ" is `correct` for "one", verifies **AC-1**
- Tolerance boundaries at accepted form lengths 3, 4, 5, 6, 9, 10, 13 (inside and one past the limit); "foru" is close for "four"; "30 years old" is `wrong` for "20 years old"; `expected` picks the nearest, then the primary, verifies **AC-2**
- "tree" for 三 is `wrong` while "thre" is `close`; "three" for 三 stays `correct` even though it is a course form; a meaning shared by two subjects is `correct` for both; an input whose "to" stripped form is another subject's meaning is `wrong`, verifies **AC-3**
- `キュウ`, `キュー`, half width `ｷｭｳ`, and `kyu-` (through `finishReadingInput`) all equal `きゅう`; にほん is correct for 日本; a non primary vocab reading is correct, verifies **AC-4**
- A kun'yomi typed for an on'yomi kanji → `wrong_kind` with `wanted: "onyomi"`, verifies **AC-5**
- `kyx`, `日`, `1`, and a lone `ー` in a reading → `invalid` (kana); `ひ` and `が` in a meaning → `invalid` (english), verifies **AC-6**
- Hook: a `wrong_kind` submit keeps the converted input, leaves the queue, accuracy, and `answeredAny` unchanged, sets `hint`; editing clears it; an empty submit keeps it; Next after `close` clears `closeTo`, verifies **AC-7**, **AC-9**
- Screens: a rejected `loadCourseForms` shows the error card, and "Try again" recovers, verifies **AC-12**
- Synonym "sunshine" accepted and "sunshin" close for 日; an item with no notes row has none; synonyms appear after meanings in the accepted list, verifies **AC-11**, **AC-12**
- On the emulator: the shake and hint for each non counting case, "Close enough" for a typo, the reading helper line, and no movement with remove animations on, verifies **AC-8**, **AC-9**, **AC-13**

## Build plan

Ordered as a tracer bullet (AGENTS.md): first one new result kind end to end through the checker, hook, and screen, then thicken each rule.

1. [x] Widen `checkReading` to return `AnswerResult` with `empty`, `invalid` (kana), `correct`, and `wrong`, plus `normalizeReading` and `isHiraganaOnly`; teach `useQuizSession` the hint, `shakeKey`, and "does not count" path; add the `AnswerInput` shake and the `QuizView` hint, satisfies **AC-6**, **AC-7**, **AC-8**, **AC-10**
2. [x] Reading rules: katakana and long vowel mark normalization, every vocab reading accepted, `wrong_kind` for kanji, and the AC-11 reading list, with Vitest, satisfies **AC-4**, **AC-5**, **AC-11**
3. [x] Meaning normalizer and forms (`meaning.ts`), `distance.ts`, the digit rule, `close` with `expected`, and the meaning `invalid` case, with Vitest; the hook passes `close` as right, and `QuizView` shows "Close enough", satisfies **AC-1**, **AC-2**, **AC-6**, **AC-9**
4. [x] Course word guard: `buildCourseForms`, `getAllMeanings`, `loadCourseForms`, and passing the required `courseForms` from both screens into the hook through one `Promise.all` that falls into the error card on failure, satisfies **AC-3**, **AC-12**
5. [x] Synonyms: `getSynonyms`, the loaders attach them, `checkMeaning` and `acceptedAnswers` use them, with query tests on `better-sqlite3`, satisfies **AC-11**, **AC-12**
6. [x] The reading helper line, then an emulator pass over every case in light and dark mode at 360dp with font scale 1.3, satisfies **AC-8**, **AC-9**, **AC-13**

## Consequences

**Positive**:
- Fewer unfair misses, so SRS stages reflect what you actually know.
- Real confusions between course words still count as wrong.
- Feature 10's synonym editor works the moment it saves a row.

**Negative / tradeoffs**:
- Typo tolerance can still accept an English word that is not in the course (for example "blank" for "plank"); the guard only knows course meanings.
- The guard rejects a few near misses that happen to be course words ("years" for 年).
- Each session does one extra read of every subject's meanings.
- Accepting every vocab reading also accepts rare or archaic alternates.

**Neutral**:
- The `Verdict` type in `check.ts` is replaced by `AnswerResult`; `acceptedAnswers` gains a `synonyms` argument. Update `check.test.ts`, `use-quiz-session.ts`, and `QuizView.tsx` together.
- The guard set grows with each enabled level; at N3 size (a few thousand meanings) it is still small.

## Follow-up

- [ ] If a guarded near miss annoys you in practice ("years" for 年), consider letting a word count as close when it is a plural of this subject's own form.
- [ ] Spec 0001 §7 still lists the thresholds without the guard, the bracket and "to" forms, or vocab accepting every reading; /sync should note that 0007 is the detailed rule.
