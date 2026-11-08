// The answer field's state for one question (spec 0007 AC-7, AC-9). Pure: no React, no DB, so
// the "does not count" rules are testable on their own. `useQuizSession` holds one of these.
import { checkMeaning, checkReading, type AnswerResult } from "@/lib/answer/check";
import { finishReadingInput } from "@/lib/answer/kana";
import type { Meaning, Reading, SubjectType } from "@/lib/types";

export type QuizVerdict = "correct" | "close" | "wrong";

export type AnswerState = {
  input: string;
  verdict: QuizVerdict | null;
  // A shake hint for an answer that does not count (wrong kind, or the wrong script).
  hint: string | null;
  // The original text of the nearest meaning, for "Close enough".
  closeTo: string | null;
  // Bumped on each shake, so the field shakes and the hint is announced again.
  shakeKey: number;
};

export type CheckableSubject = {
  type: SubjectType;
  meanings: Meaning[];
  readings: Reading[];
  synonyms: string[];
};

export const initialAnswer: AnswerState = {
  input: "",
  verdict: null,
  hint: null,
  closeTo: null,
  shakeKey: 0,
};

// Typing while the result shows does nothing; typing before it clears the hint.
export function editAnswer(state: AnswerState, text: string): AnswerState {
  if (state.verdict !== null) return state;
  return { ...state, input: text, hint: null };
}

export function hintFor(result: AnswerResult): string | null {
  if (result.result === "wrong_kind") {
    return `Looking for the ${result.wanted === "onyomi" ? "on'yomi" : "kun'yomi"}`;
  }
  if (result.result === "invalid") {
    return result.wanted === "kana" ? "Type the reading in kana" : "Type the meaning in English";
  }
  return null;
}

/**
 * Checks the input. The converted text always stays in the field. `empty` changes nothing else;
 * `wrong_kind` and `invalid` set a hint and shake without a verdict; `correct`, `close`, and
 * `wrong` set the verdict. `counted` says whether an answer was judged (for the leave guard).
 */
export function checkAnswer(
  state: AnswerState,
  kind: "meaning" | "reading",
  subject: CheckableSubject,
  courseForms: ReadonlySet<string>,
): { state: AnswerState; counted: boolean } {
  if (state.verdict !== null) return { state, counted: false };
  const input = kind === "reading" ? finishReadingInput(state.input) : state.input;
  const result =
    kind === "meaning"
      ? checkMeaning(input, subject, subject.synonyms, courseForms)
      : checkReading(input, subject);
  const next = { ...state, input };
  switch (result.result) {
    case "empty":
      return { state: next, counted: false };
    case "wrong_kind":
    case "invalid":
      return {
        state: { ...next, hint: hintFor(result), shakeKey: state.shakeKey + 1 },
        counted: false,
      };
    case "close":
      return {
        state: { ...next, verdict: "close", closeTo: result.expected, hint: null },
        counted: true,
      };
    default:
      return { state: { ...next, verdict: result.result, hint: null }, counted: true };
  }
}

// Next: a fresh field for the next question. The shake key keeps counting.
export function clearAnswer(state: AnswerState): AnswerState {
  return { ...initialAnswer, shakeKey: state.shakeKey };
}
