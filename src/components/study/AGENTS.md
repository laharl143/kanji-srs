# src/components/study

The shared pieces of the lesson quiz and review screens (`src/app/lessons.tsx`, `src/app/reviews.tsx`). Governing spec: [0004 core study loop](../../../docs/specs/0004-core-loop/index.md). Built on the base kit in `../ui/` (see its AGENTS.md).

## Files

Import from the barrel `@/components/study` (`index.ts`).

- `use-quiz-session.ts`: drives one session over the pure queue in `@/lib/study/queue`. First submit checks, second moves on. Saves a finished item through the `save` callback; an error result shows a toast and drops the item, never retried.
- `QuizView.tsx`: prompt, answer field, result, and the Check / Next button.
- `PromptBand.tsx`: characters on the subject color, the type badge, and the Meaning / Reading strip (inverted for reading).
- `AnswerInput.tsx`: the one answer field. Reading mode converts romaji to hiragana with `toReadingInput` from `@/lib/answer/kana`.
- `LessonPage.tsx`: one lesson item (meanings, readings, components, mnemonics).
- `use-leave-guard.ts` and `LeaveDialog.tsx`: asks before leaving once an answer is in, through expo-router's `usePreventRemove` (the stack's `beforeRemove`).
- `SessionStates.tsx`: loading, message (empty and error), and "Done, N items" cards. `HeaderCount.tsx`: the "N left" app bar pill.
- `subject-style.ts`: literal subject color classes and labels.

## Rules

- Keep screens thin: data goes through `@/lib/study` services; nothing here writes SQL or reads the clock.
- Subject color classes must stay full literal strings (NativeWind cannot read class names built at runtime).
- The `testID`s here (`prompt-characters`, `answer-input`, `answer-submit`, `session-remaining`, `session-done`, `session-home`) are used by `maestro/core-loop.yaml`; rename them in both places.
- Turn the leave guard off once the session is done, so finishing never asks.

_Drafted by /sync from the introducing change, worth a quick human pass._
