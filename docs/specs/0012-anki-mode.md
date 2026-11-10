# 0012. Anki mode: reveal the answer and grade yourself

**Date**: 2026-11-10
**Status**: Accepted

## Summary

Anki mode is a switch in Settings. When it is on, reviews and the lesson quiz stop asking you to type: each item shows as one card, you tap Show answer to see its meaning and reading together, then grade yourself with Missed or Got it. Got it moves the item up a stage like a right answer; Missed drops it one step, like one wrong typed answer. The switch is a new column on your settings row, off by default, so typing stays the normal mode.

## Context

You study on your phone, and typing every meaning and reading (with romaji turning into kana) is slow when you just want to run through a pile of reviews. Many learners prefer flash card style recall: look, recall in your head, check, and be honest about it. The app has no way to study like that.

The quiz today is built around typed answers. `src/lib/study/queue.ts` gives each item one question per kind (`questionsFor`: radicals ask meaning, kanji and vocab ask meaning and reading), shuffles them apart, records a wrong answer as `wrongMeaning` or `wrongReading`, and sends the item back into the queue until each kind is answered right. When an item is done, `applyReview` in `src/lib/srs/schedule.ts` computes the new stage from those counts: no wrongs moves up one stage; any wrongs move down by `ceil(wrong / 2)` times a penalty. `QuizView` shows the typed field, the verdict, and the "Not quite" card.

Settings live in one `user_settings` row (`src/lib/db/schema.ts`) and are saved through `saveSettings` in `src/lib/study/settings.ts`; migrations are Drizzle SQL files in `drizzle/` that run on launch (`src/lib/db/migrate.ts`).

## Requirements

**User stories**:
- As a learner, I want to review by revealing the answer and grading myself, so that I can get through reviews quickly without typing.
- As a learner, I want my self grade to move items through the stages the same way typed answers do, so that Anki mode is not a shortcut around the SRS.

**Acceptance criteria**:
- **AC-1**: Settings has a "Study style" card, above the Lessons card, with one switch row: "Anki mode", subtitle "Reveal the answer and grade yourself instead of typing". It is off on a fresh install and after an upgrade. Flipping it saves at once; when the save fails, a toast says "Could not save. Try again." and the switch goes back.
- **AC-2**: A review session or lesson quiz reads the setting when it starts. Flipping the switch during a session changes only the next session.
- **AC-3**: With Anki mode on, every item is one card. It shows the type colored band with the characters (as the quiz does today) and the label "Meaning and reading" for kanji and vocab, or "Meaning (radical name)" for radicals, with a full width "Show answer" button where the answer field would be. There is no text field and no keyboard.
- **AC-4**: Show answer reveals, under the band: the meanings (primary first) followed by your synonyms, and for kanji and vocab the readings as on the lesson page (primary ones highlighted), plus a "Show details" toggle (collapsed) for the meaning and reading mnemonics and your notes. The Show answer button is replaced by two buttons side by side, "Missed" and "Got it", each at least 48dp.
- **AC-5**: Got it on an item that was never missed in this session records it right: it moves up one stage, exactly as an item answered right on every typed question. Got it after a miss finishes the item with the miss counted.
- **AC-6**: Missed records one wrong answer for the item (stored as one wrong meaning answer) and sends the card back into the queue, to come again later in the session, as a wrong typed answer does. When the item is finally finished, its new stage is computed by `applyReview` from that count, so one miss drops it like one wrong typed answer, and two misses like two.
- **AC-7**: The "N left" count, the accuracy (Got it on the first show counts as right first try), the wrap up switch, the leave guard (a grade counts as an answer), and the review summary all work in Anki mode as they do when typing.
- **AC-8**: The lesson quiz follows the same switch: with Anki mode on, the quiz after a lesson batch uses the same cards and grades, and the items finish their lesson the same way.
- **AC-9**: With Anki mode off, reviews and the lesson quiz behave exactly as before this feature (typed questions, meaning and reading apart).
- **AC-10**: The card reads correctly at 360dp wide, at a 1.3 font scale, in light and dark mode, and with TalkBack (Show answer, Missed, and Got it are buttons with those labels and the test IDs `anki-show-answer`, `anki-missed`, and `anki-got-it`; the revealed answer is announced).

## Options considered

### Option 1: One card per item, two grades

Each item becomes one question of a new kind, `card`. Reveal shows meaning and reading together; Missed or Got it. A miss is stored as one wrong answer, so the existing stage math applies unchanged.

**Pros**:
- Half the reveals and grades of keeping meaning and reading apart; the flash card feel you asked for.
- No change to the SRS math or the reviews table.

**Cons**:
- The stats lose whether you missed the meaning or the reading; every Anki miss is stored as a meaning miss.

### Option 2: Keep separate meaning and reading cards

Each typed question becomes a reveal and grade, one kind at a time.

**Pros**:
- Meaning and reading misses stay apart in the stats.

**Cons**:
- Twice the taps for every kanji and word, the slowness Anki mode is meant to remove.

### Option 3: Anki's four grades (Again, Hard, Good, Easy)

**Pros**:
- Familiar to Anki users.

**Cons**:
- The SRS has fixed stages and no "hard" or "easy"; it would need new stage rules, a much bigger change.

## Decision

**Chosen option**: Option 1: one card per item with Missed and Got it, in reviews and the lesson quiz, behind a switch in a new Study style card.

A new question kind `card` lets the existing queue, verdict recording, and stage math carry Anki mode with no change to how stages move.

## Rationale

You want fewer steps per review, and the app's SRS already reduces every answer to right or wrong per item. A single card graded one of two ways fits that exactly: Got it is a right answer, Missed is a wrong one, and `applyReview` needs no change. Storing a miss as one wrong meaning answer keeps the stage math identical to a single wrong typed answer (`ceil(1 / 2)` is one penalty step), which keeps Anki mode honest. The cost is the meaning and reading split in the stats, which nothing in the app reads today beyond the stored counts.

Applying it to the lesson quiz too keeps one rule (switch on, no typing), your pick over a typed lesson quiz. The Study style card with a switch row matches the Reminders switches already in Settings, your pick over the tile look, and leaves room for more study options later.

## Feature design

**Data model sketch**: one new column, one migration.
- `user_settings.anki_mode`: integer boolean, not null, default false. Drizzle: `ankiMode: integer("anki_mode", { mode: "boolean" }).notNull().default(false)`, safe on existing rows (they read false).
- Migration steps: change `schema.ts`, run `npm run db:generate` (a new `drizzle/0001_*.sql`, its `meta` snapshot, and a journal entry), use that generated SQL as is (do not hand write it), make sure `drizzle/migrations.js` imports the new migration (edit it if the generator did not), and confirm the Vitest database helper runs it. Every fixture that builds a `UserSettings` gains the field.
- No change to `reviews` or `assignments`: an Anki miss in a review writes `incorrect_meaning_count`, never a reading miss. Lesson quiz misses are not stored at all, as today (`completeLessonItem` takes only the subject).

**Places that switch on the question kind** (`QuestionKind` gains `"card"`; each must handle it):
- `answerCurrent` (`queue.ts`): count a wrong answer as `wrongMeaning` when the kind is not `"reading"` (so `card` adds to `wrongMeaning`), and requeue as today. A right `card` finishes the item. Accuracy and `tried` work per kind as today, so a card counts once.
- `questionsFor(type, mode)` (`queue.ts`): `["card"]` when `mode` is `"anki"`, today's list otherwise. `createQueue` stays unchanged; `useQuizSession` builds the items' questions with `questionsFor(s.type, mode)`.
- `PromptBand`: a `card` branch with the label "Meaning and reading" for kanji and vocab, "Meaning (radical name)" for radicals.
- `QuizView`: renders `AnkiCard` instead of `AnswerInput` and the verdict blocks when the kind is `card`. `AnswerInput` and `checkAnswer` keep their `"meaning" | "reading"` types and are never reached for a card.

**Session hook** (`useQuizSession`):
- Takes `mode: "typed" | "anki"`. `QuizSession` gains `mode`, `revealed: boolean`, `reveal()`, and `grade(right: boolean)`. In Anki mode `verdict` is always null, `input` is empty, and `submit` does nothing.
- `reveal()` sets `revealed`; it does not count as an answer for the leave guard.
- `grade(right)` returns at once while `saving` (as `submit` does), else calls `answerCurrent(queue, right)`, sets `answeredAny`, persists a finished item, and clears `revealed`. The grade buttons show `loading` while saving, so a double tap cannot grade twice.

**Components**:
- `AnkiCard` (new, `src/components/study/AnkiCard.tsx`): Show answer (testID `anki-show-answer`); after reveal, the meanings from `acceptedAnswers("meaning", subject, subject.synonyms)` (the live session subject, so a synonym added through spec 0011's sheet shows), the readings through `Readings` from `src/components/subject/` for kanji and vocab, Show details, and the buttons Missed (`anki-missed`) and Got it (`anki-got-it`). It is keyed by the question, so Show details starts collapsed on every new card.
- `ShowDetails` moves out of `QuizView` into its own file so both views share it. A new pure helper `cardDetails(details)` in `quiz-details.ts` returns the meaning mnemonic and note, then the reading mnemonic and note (reading parts left out for radicals); the toggle is hidden when all are empty.
- `ReviewSummary` needs no change: it splits on `wrongMeaning + wrongReading === 0`, so an Anki miss lists the item as missed.
- `lessons.tsx` and `reviews.tsx` add the existing `getSettings` (`src/lib/db/queries/settings.ts`) to the `Promise.all` that loads the batch, put `mode` (`settings.ankiMode ? "anki" : "typed"`) into the ready state, and pass it to `useQuizSession`. The loaders stay unchanged.
- Settings: a `SettingsCard title="Study style"` above Lessons, with a switch row built like the Reminders rows. `ankiMode` joins the `SettingsPatch` pick and the switch and allowed key lists that `checkSettingsPatch` uses.

**API surface** (local services):
| Function | Change | Output | Errors |
|---|---|---|---|
| `getSettingsPage` (`study/settings.ts`) / `getSettings` (`db/queries/settings.ts`) | none (they return the whole row, now with `ankiMode`) | settings including `ankiMode: boolean` | as today |
| `saveSettings` (`settings.ts`) | accepts `{ ankiMode: boolean }` | `{ ok: true, settings }` | as today; toast on failure |

**Value sourcing**:
| Action | Value produced or displayed | Source |
|---|---|---|
| Settings switch | on or off | `user_settings.anki_mode` |
| Session start | the mode | `getSettings(...).ankiMode`, read once when the batch loads |
| Card label | "Meaning and reading" or "Meaning (radical name)" | `subject.type` |
| Reveal | meanings and synonyms | `subject.meanings` and the session's `synonyms` (`acceptedAnswers`) |
| Reveal | readings | `subject.readings`, primary flagged, as on the lesson page |
| Reveal | details | `cardDetails(subject.details)` (mnemonics and notes, 0009 AC-7) |
| Grade | right or wrong | the button pressed |
| Finish item | new stage | `applyReview(assignment, wrongMeaning = misses, wrongReading = 0, now)` |
| Accuracy | first try right | `firstTryRight` in the queue, one try per card |

**Key invariants**:
- An item in Anki mode has exactly one question, of kind `card`; it never has `meaning` or `reading` questions in the same session.
- One Missed equals one wrong answer in the stage math; Got it with no misses equals all right.
- With `anki_mode` false, the queue and the quiz are unchanged.

**Security model**: single local user, no new data beyond one setting.

**Critical test scenarios**:
- Fresh install and an upgraded install: Settings shows Anki mode off, verifies **AC-1**
- Anki mode on, review a stage 3 kanji: Show answer reveals meaning and readings; Got it → the item finishes at stage 4, verifies **AC-3**, **AC-4**, **AC-5**
- Missed once then Got it on a stage 3 item → stage 2 (one penalty step), the summary lists it as missed; Missed twice then Got it → `ceil(2/2)` one step as well, matching typed, verifies **AC-6**
- Unit: `questionsFor(type, "anki")` is `["card"]`; `answerCurrent` on a wrong card adds one `wrongMeaning` and requeues, verifies **AC-6**
- Flip the switch during a review: the session keeps typing; the next session uses cards, verifies **AC-2**
- Lesson batch with Anki mode on: the quiz uses cards and the items reach stage 1, verifies **AC-8**
- Anki mode off: the existing core loop Maestro flow and the typed tests still pass, verifies **AC-9**
- Accuracy, wrap up, and the leave guard during an Anki session, verifies **AC-7**
- Save failure on the switch: toast and the switch goes back, verifies **AC-1**

## Build plan

1. Schema and settings: `anki_mode` column, the Drizzle migration generated and applied (checked on the emulator after a launch on an existing database), `ankiMode` in `SettingsPatch` and the key lists, with tests, satisfies **AC-1**, **AC-2**
2. Queue: the `card` kind, `questionsFor(type, mode)`, `answerCurrent` counting a wrong card as a meaning miss, with unit tests including the stage math through `applyReview`, satisfies **AC-5**, **AC-6**, **AC-9**
3. Session hook: the mode in `useQuizSession`, `reveal` and `grade` (leave guard, saving guard), persist and accuracy, satisfies **AC-5**, **AC-6**, **AC-7**
4. `PromptBand` card label, `ShowDetails` moved out and `cardDetails`, `AnkiCard` in `QuizView` with its test IDs, the reviews and lesson screens reading the mode at load, and a check that `ReviewSummary` lists Anki misses, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-8**
5. The Study style card with the switch in Settings, satisfies **AC-1**
6. Emulator pass at 360dp, font scale 1.3, light and dark, TalkBack; run the existing typed tests and the core loop flow with Anki mode off, satisfies **AC-9**, **AC-10**

## Consequences

**Positive**:
- Reviews go faster with no keyboard, and stages still move by the same rules.
- No change to the SRS math, the reviews table, or the typed quiz.

**Negative / tradeoffs**:
- Self grading is on your honor; nothing checks that you really knew it.
- An Anki miss is always stored as a meaning miss, so the stored counts no longer tell you which half you missed for Anki sessions.
- One schema change, so the app needs the migration on launch (and the first launch after the update runs it).

**Neutral**:
- The question kind list grows by one (`card`), which every switch on `QuestionKind` must handle.
- The quick synonyms icon (spec 0011) works the same in Anki mode, and a synonym added before Show answer appears in the revealed list.

## Follow-up

- [ ] Add the Anki mode on path to the Maestro core loop flow at the next release build check (Release build checks in the scope).
