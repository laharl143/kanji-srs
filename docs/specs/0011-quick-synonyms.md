# 0011. Add synonyms from lessons and reviews without leaving the session

**Date**: 2026-11-10
**Status**: In Progress

## Summary

You can now add your own meaning for an item right where you meet it. A "+ Add synonym" link sits on the lesson page, and an icon in the top bar of the lesson quiz and reviews opens the same small sheet (a panel that slides up from the bottom) with the synonym editor from the item page. A synonym you add counts at once, for the rest of the session, but an answer you already checked keeps its verdict, so a miss still counts as a miss. There is no database change; synonyms keep living in your notes.

## Context

Spec 0009 lets you add synonyms, but only on an item's own page (Levels tab, then the level, then the tile). Many radicals in this app carry names you already know under other words from earlier study. In a review you type the name you know ("swoosh"), the app wants its own ("speck"), and the fix means leaving the session and digging the item out of the level browser, once per radical. That is slow enough that you skip it, and then the same radical trips you again.

Two rules from earlier specs shape this. Sessions read your synonyms once when they load (0007 AC-12, 0009 AC-7), so an edit made mid session counts only from the next session. And the quiz records an answer only when you press Next after seeing the verdict (`answerCurrent` in `src/lib/study/queue.ts`), so a checked answer is still open until then.

The quiz must not give the answer away. A sheet opened before you answer cannot show the accepted meanings or the mnemonic.

## Requirements

**User stories**:
- As a learner, I want to add the name I already know for an item while I am studying it, so that the app accepts it from then on without a trip to the level browser.
- As a learner, I want a miss to stay a miss even if I add the word afterwards, so that my stages stay honest.

**Acceptance criteria**:
- **AC-1**: On a lesson page, the Meaning card (the Name card for radicals) shows a "+ Add synonym" link after the meanings and "Also accepted" line. Tapping it opens the synonym sheet for that item: a title naming the item ("Your synonyms for 行"; "Your synonyms for this radical" when it has no characters), the `SynonymEditor` from 0009 (your synonym chips with remove buttons, a field, and an Add button), and a Done button. The same checks and messages as 0009 AC-5 apply.
- **AC-2**: A synonym added or removed on a lesson page shows at once in that page's "Also accepted" line, and the lesson quiz for the same batch accepts it (or stops accepting it).
- **AC-3**: In the lesson quiz and in reviews, while a question shows, the top bar has an add synonym icon button to the left of the count pill, at least 48dp, with the TalkBack label "Add a synonym for this item". It is hidden on the summary and empty screens. Tapping it opens the synonym sheet for the current question's item. The sheet shows only your own synonyms and the editor, never the accepted meanings, readings, or mnemonics, on meaning and reading questions alike.
- **AC-4**: A synonym added from the sheet counts at once: if you have not checked the current answer yet, the check uses it, and every later question in the session uses it. A synonym you remove stops counting the same way.
- **AC-5**: When the current answer already shows its verdict, adding or removing a synonym does not change that verdict. A wrong answer still counts as wrong when you press Next, even if you added exactly what you typed. The "Accepted meanings" line on the "Not quite" card shows the updated list.
- **AC-6**: When a save fails, a toast says "Could not save. Try again.", the text stays in the field (or the chip stays), and the session's synonyms do not change (0009 AC-6).
- **AC-7**: Opening and closing the sheet keeps the question, your typed answer, the verdict, and the queue exactly as they were. Done, a tap outside the sheet, or the Android back button closes the sheet; back does not open the leave dialog while the sheet is open. Adding a synonym never counts as answering for the leave guard.
- **AC-8**: A synonym added from a session is saved to your notes like one added on the item page: it shows on the item page and is accepted in every later session.
- **AC-9**: The sheet reads correctly at 360dp wide, at a 1.3 font scale, in light and dark mode, and with TalkBack; the keyboard does not cover the field.

## Options considered

### Option 1: A button on the "Not quite" card that adds your typed answer

One tap after a miss adds what you typed as a synonym. Fast for the exact case in the screenshot.

**Pros**:
- One tap, nothing to type.

**Cons**:
- Only reachable after a miss on a meaning question; you cannot add a name you know before answering or on a lesson page.
- Raises a second question about whether the miss still counts on every use.

### Option 2: A sheet with the full editor, opened from a link on the lesson page and a top bar icon in sessions

The same editor the item page uses, reachable at any moment of a lesson or review.

**Pros**:
- Works before or after answering, on lessons and in quizzes, and lets you remove a synonym too.
- Reuses `SynonymEditor`, `addSynonym`, and `removeSynonym` unchanged.

**Cons**:
- Two taps and some typing for the "add what I just typed" case.
- A sheet opened before answering must hide the answer, so it shows less than the item page.

### Option 3: Keep it on the item page and add a jump link from the session

A link that opens the item page and returns to the session.

**Pros**:
- No new UI beyond a link.

**Cons**:
- Navigating away mid session risks the leave guard and loses your place; the item page shows the answer.

## Decision

**Chosen option**: Option 2: a synonym sheet, opened from a "+ Add synonym" link on lesson pages and a top bar icon in the lesson quiz and reviews.

The sheet edits the saved synonyms and the session's copy together; a checked answer keeps its verdict.

## Rationale

You asked for a dedicated button you can press whenever you know an item under another name, not only after a miss; Option 1 cannot do that. Option 3 leaves the session and shows the answer. Option 2 reuses everything 0009 built, so the new code is the sheet and the session's ability to update its synonym list.

The icon sits in the top bar (your pick over a link under the main button, which the keyboard can cover, and a chip on the question band, which crowds it). The lesson page uses a link in the Meaning card instead (your pick), since a lesson page has no answer to protect and the link sits next to the meanings it extends.

Counting a synonym at once (your pick) changes the "read once at start" rule from 0007 AC-12 and 0009 AC-7 for edits made in the session; the reason for that rule was simplicity, not correctness, and the session already holds its synonyms in memory. Keeping a checked verdict (your pick over flipping it to correct) keeps stages honest: adding the word you just missed helps every later question, but it cannot rescue the one you missed. A side effect is that the verdict logic needs no change at all, because the verdict is already frozen once shown.

## Feature design

**Data model sketch**: no schema change, no migration. Writes `user_notes.synonyms` and `updated_at` through the existing `addSynonym` and `removeSynonym` in `src/lib/study/items.ts` (each runs in one `withTransaction`).

**State**:
- `useQuizSession` keeps its subjects in state (today a `useState` map that never changes) and exposes `setSynonyms(subjectId, synonyms)`, which replaces that subject's `synonyms`. `checkAnswer` already reads `subject.synonyms`, so the next check uses the new list. The current `AnswerState` is not touched, so a shown verdict stays (AC-5).
- `LessonFlow` (`src/app/lessons.tsx`) keeps `items` in state and updates an item's `synonyms` after a save, so the lesson page and the `LessonQuiz` built from those items both see it (AC-2).

**Components**:
- `src/components/subject/SynonymSheet.tsx` (new): a React Native `Modal` (transparent, slide animation, the same approach as `ConfirmDialog`) anchored to the bottom, with the title, `SynonymEditor`, and Done. Props: `title`, `synonyms`, `subjectId`, `onChange(synonyms)`, `onClose`. It calls `addSynonym` and `removeSynonym` with `Date.now()`, maps results to `SynonymEditor`'s `AddOutcome`, calls `onChange` with the saved list on success, and shows the 0009 toast on failure. `onRequestClose` closes it (Android back, AC-7). `KeyboardAvoidingView` keeps the field above the keyboard (AC-9).
- `LessonPage`: the "+ Add synonym" link (a `Pressable`, 48dp, primary color) in the Meaning or Name card, opening the sheet.
- `src/components/study/SynonymButton.tsx` (new): the top bar icon button (`MaterialCommunityIcons` `tag-plus`, white on the app bar). `lessons.tsx` and `reviews.tsx` render it beside `HeaderCount` in `headerRight` while a question shows, and render the sheet for `session.subject`.

**API surface** (local services, all existing, unchanged):
| Function | Inputs | Output | Errors |
|---|---|---|---|
| `addSynonym` (`items.ts`) | `subjectId`, `text`, `now` | `{ ok: true, synonyms }` · `{ ok: false, error: "invalid", reason }` · `{ ok: false, error: "not_found" }` | thrown error → toast |
| `removeSynonym` (`items.ts`) | `subjectId`, `text`, `now` | `{ ok: true, synonyms }` · `not_found` | thrown error → toast |

**Value sourcing**:
| Action | Value produced or displayed | Source |
|---|---|---|
| Open sheet | the item named in the title | `subject.characters`; "this radical" when null |
| Open sheet | the chips | the session's (or lesson item's) `synonyms`, seeded by `getSynonyms` when the batch loaded and replaced after each save |
| Add or remove | the saved list | the `synonyms` returned by `addSynonym` / `removeSynonym` (the stored truth, not a local guess) |
| Add | the refusal message | `checkSynonym` reason via `synonymRefusalMessage` (0009) |
| Check an answer | accepted meanings | `subject.meanings` plus the session's current `synonyms` |
| Save | `updated_at` | `now` passed as `Date.now()` |

**Key invariants**:
- The session's copy of an item's synonyms always equals the last list a save returned, or the list loaded at start when nothing was saved.
- A verdict, once shown, never changes until Next.
- The sheet never renders accepted meanings, readings, mnemonics, or notes.

**Security model**: single local user, no new data or permissions.

**Critical test scenarios**:
- Review 丶 (named "speck"): open the sheet before answering, add "swoosh", close, type "swoosh" → Correct, verifies **AC-3**, **AC-4**
- Review 丶: type "swoosh" → Not quite, open the sheet, add "swoosh", close → still Not quite, "Accepted meanings" reads "speck, swoosh", Next records the miss; when 丶 comes back in the same session, "swoosh" → Correct, verifies **AC-4**, **AC-5**
- Lesson page for 行: "+ Add synonym", add "going" → "Also accepted" shows it; the quiz for that batch accepts "going", verifies **AC-1**, **AC-2**
- Sheet before answering shows no meanings or mnemonic; the "Already accepted" refusal appears only after you try a meaning, verifies **AC-3**
- Save fails (database error) → toast, text stays, the session still refuses the word, verifies **AC-6**
- Back button with the sheet open closes only the sheet; typed text and queue unchanged, verifies **AC-7**
- After the session, the item page shows the synonym, and a new session accepts it, verifies **AC-8**
- Unit: `setSynonyms` replaces only that subject's list and leaves the answer state alone, verifies **AC-4**, **AC-5**

## Build plan

1. [x] Session state: subjects in state in `useQuizSession`, `setSynonyms(subjectId, synonyms)` exposed, the update kept in a small pure helper with a unit test; the verdict untouched, satisfies **AC-4**, **AC-5**
2. [x] `SynonymSheet` around `SynonymEditor` with the save, toast, back button, and keyboard handling, satisfies **AC-1**, **AC-6**, **AC-7**, **AC-8**, **AC-9**
3. [x] Lessons: `items` in state in `LessonFlow`, the "+ Add synonym" link in the lesson page's Meaning or Name card, opening the sheet and updating the item, satisfies **AC-1**, **AC-2**
4. [x] Quizzes: `SynonymButton` in `headerRight` of the lesson quiz and reviews, opening the sheet for the current subject and calling `setSynonyms`, satisfies **AC-3**, **AC-4**, **AC-7**
5. [ ] Emulator pass at 360dp, font scale 1.3, light and dark, TalkBack labels; the test scenarios above, satisfies **AC-8**, **AC-9** (partly done 2026-11-10 in Expo Go: scenarios 1 to 4, 6 and 7 pass, and the lesson sheet reads at 360dp, 1.3 font scale, dark mode, with the keyboard up; still open: a forced save failure (AC-6), the quiz top bar at 360dp and 1.3, and a TalkBack pass)

## Consequences

**Positive**:
- Fixing a known name takes a few seconds inside the session.
- No schema, service, or validation change; 0009's rules hold everywhere.

**Negative / tradeoffs**:
- The "Already accepted" refusal can hint that a word is a meaning if you try it before answering. Accepted: you have to guess the word first.
- A miss you then add as a synonym still costs the stage once, by your choice.
- One more control in the session top bar.

**Neutral**:
- 0007 AC-12 and 0009 AC-7 ("synonyms are read once when a session loads") now hold only for edits made outside the session.

## Follow-up

- [ ] Add a line to 0009 (Consequences) and 0007 AC-12 noting that edits from the session sheet count at once (spec 0011).
