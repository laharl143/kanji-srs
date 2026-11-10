# src/components/study

The shared pieces of the lesson quiz and review screens (`src/app/lessons.tsx`, `src/app/reviews.tsx`). Governing spec: [0004 core study loop](../../../docs/specs/0004-core-loop/index.md); the review window, Wrap up, header accuracy, and the summary come from [0006 SRS progression](../../../docs/specs/0006-srs-progression/index.md). Built on the base kit in `../ui/` (see its AGENTS.md).

## Files

Import from the barrel `@/components/study` (`index.ts`).

- `use-quiz-session.ts`: drives one session over the pure queue in `@/lib/study/queue`. First submit checks, second moves on. Saves a finished item through the `save` callback; an error result shows a toast and drops the item, never retried. Generic over the save result (the lesson quiz keeps `{ ok: true }`); takes `windowSize` and exposes `accuracy`, `wrappingUp`, `canWrapUp`, `toggleWrapUp`, and `results` (each saved item with its service result), plus `setSynonyms(subjectId, synonyms)` (spec [0011](../../../docs/specs/0011-quick-synonyms.md)), which replaces one subject's synonyms so the next check uses them while a verdict already shown stays.
- `QuizView.tsx`: prompt, answer field, result, and the Check / Next button.
- `answer-state.ts`: pure answer state for one question (spec [0007](../../../docs/specs/0007-answer-checking/index.md)): `checkAnswer` turns an `AnswerResult` into a verdict (`correct`, `close`, `wrong`) or a hint that does not count, `hintFor` gives the hint text, `editAnswer` clears a hint as you type, and `shakeKey` bumps on each wrong kind or invalid submit.
- `PromptBand.tsx`: characters on the subject color, the type badge, and the Meaning / Reading strip (inverted for reading).
- `AnswerInput.tsx`: the one answer field. Reading mode converts romaji to hiragana with `toReadingInput` from `@/lib/answer/kana`.
- `LessonPage.tsx`: one lesson item (meanings, readings, components, mnemonics).
- `use-leave-guard.ts` and `LeaveDialog.tsx`: asks before leaving once an answer is in, through expo-router's `usePreventRemove` (the stack's `beforeRemove`).
- `SessionStates.tsx`: loading, message (empty and error), and "Done, N items" cards. `HeaderCount.tsx`: the "N left" app bar pill, with the accuracy ("66% | 25 left") once the first answer is in; its accessibility label says both numbers.
- `ReviewSummary.tsx`: the end of session summary that replaces the Done card on `/reviews` (title, tiles, level banner, new lessons line, Correct and Incorrect groups, Home plus Start lessons and Keep reviewing). The lesson quiz keeps the Done card.
- `quiz-details.ts`: `detailsFor(details, kind)` picks the mnemonic and your note for the question's kind for the Not quite card's Show details toggle (hidden when both are empty; collapsed again on every new question).
- `subject-style.ts`: literal subject color classes and labels.
- `session-synonyms.ts`: pure `withSynonyms` (behind `setSynonyms`) and `synonymSheetTitle` ("Your synonyms for 行", or "this radical"). `SynonymButton.tsx`: the 48dp tag icon left of `HeaderCount` in the lesson quiz and review top bar, shown only while a question shows; it opens `SynonymSheet` from `../subject/` for the current subject (spec 0011). `LessonPage` takes `onAddSynonym` for its "+ Add synonym" link.
- `LessonPage` and `QuizView` reuse `Section`, `Mnemonic`, `NoteText`, `Readings`, and `SpeakButton` from `../subject/`.

## Rules

- Keep screens thin: data goes through `@/lib/study` services; nothing here writes SQL or reads the clock.
- Subject color classes must stay full literal strings (NativeWind cannot read class names built at runtime).
- The `testID`s here (`prompt-characters`, `answer-input`, `answer-submit`, `session-remaining`, `session-done`, `session-home`) are used by `maestro/core-loop.yaml`; rename them in both places.
- The review summary keeps the title "Done, N items" and the `session-done` and `session-home` IDs so that flow still passes. Its own IDs (`summary-level-up`, `summary-new-lessons`, `summary-correct`, `summary-incorrect`, `summary-start-lessons`, `summary-keep-reviewing`), plus `session-accuracy` and `review-wrap-up`, are for tests and scripted checks.
- Turn the leave guard off once the session is done, so finishing never asks.
- `AnswerInput` uses `keyboardType="visible-password"` for meaning questions on Android, because Gboard ignores `autoCorrect={false}` and commits its suggestion on Enter. Keep `key={kind}` on the `TextInput`: switching kind on a mounted field would leak that keyboard into the reading field.
- Render a Modal (such as `SynonymSheet`) outside any ScrollView that lacks `keyboardShouldPersistTaps="handled"` (the lesson page's `PagedLayout` in `src/app/lessons.tsx` is one). A Modal's touches bubble through its React parents, and such a ScrollView closes the keyboard and swallows the first tap.
- `session-add-synonym`, `lesson-add-synonym`, and `lesson-also-accepted` are test IDs for scripted checks.
- The hint (`answer-hint`) remounts with `key={shakeKey}` so TalkBack reads it again on every repeat. `answer-close` and `accepted-answers` are test IDs for scripted checks.

_Drafted by /sync from the introducing change, worth a quick human pass._
