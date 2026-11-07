# src/components/study

The shared pieces of the lesson quiz and review screens (`src/app/lessons.tsx`, `src/app/reviews.tsx`). Governing spec: [0004 core study loop](../../../docs/specs/0004-core-loop/index.md); the review window, Wrap up, header accuracy, and the summary come from [0006 SRS progression](../../../docs/specs/0006-srs-progression/index.md). Built on the base kit in `../ui/` (see its AGENTS.md).

## Files

Import from the barrel `@/components/study` (`index.ts`).

- `use-quiz-session.ts`: drives one session over the pure queue in `@/lib/study/queue`. First submit checks, second moves on. Saves a finished item through the `save` callback; an error result shows a toast and drops the item, never retried. Generic over the save result (the lesson quiz keeps `{ ok: true }`); takes `windowSize` and exposes `accuracy`, `wrappingUp`, `canWrapUp`, `toggleWrapUp`, and `results` (each saved item with its service result).
- `QuizView.tsx`: prompt, answer field, result, and the Check / Next button.
- `PromptBand.tsx`: characters on the subject color, the type badge, and the Meaning / Reading strip (inverted for reading).
- `AnswerInput.tsx`: the one answer field. Reading mode converts romaji to hiragana with `toReadingInput` from `@/lib/answer/kana`.
- `LessonPage.tsx`: one lesson item (meanings, readings, components, mnemonics).
- `use-leave-guard.ts` and `LeaveDialog.tsx`: asks before leaving once an answer is in, through expo-router's `usePreventRemove` (the stack's `beforeRemove`).
- `SessionStates.tsx`: loading, message (empty and error), and "Done, N items" cards. `HeaderCount.tsx`: the "N left" app bar pill, with the accuracy ("66% | 25 left") once the first answer is in; its accessibility label says both numbers.
- `ReviewSummary.tsx`: the end of session summary that replaces the Done card on `/reviews` (title, tiles, level banner, new lessons line, Correct and Incorrect groups, Home plus Start lessons and Keep reviewing). The lesson quiz keeps the Done card.
- `subject-style.ts`: literal subject color classes and labels.

## Rules

- Keep screens thin: data goes through `@/lib/study` services; nothing here writes SQL or reads the clock.
- Subject color classes must stay full literal strings (NativeWind cannot read class names built at runtime).
- The `testID`s here (`prompt-characters`, `answer-input`, `answer-submit`, `session-remaining`, `session-done`, `session-home`) are used by `maestro/core-loop.yaml`; rename them in both places.
- The review summary keeps the title "Done, N items" and the `session-done` and `session-home` IDs so that flow still passes. Its own IDs (`summary-level-up`, `summary-new-lessons`, `summary-correct`, `summary-incorrect`, `summary-start-lessons`, `summary-keep-reviewing`), plus `session-accuracy` and `review-wrap-up`, are for tests and scripted checks.
- Turn the leave guard off once the session is done, so finishing never asks.

_Drafted by /sync from the introducing change, worth a quick human pass._
