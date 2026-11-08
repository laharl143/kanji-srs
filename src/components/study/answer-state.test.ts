import { describe, expect, it } from "vitest";

import {
  checkAnswer,
  clearAnswer,
  editAnswer,
  initialAnswer,
  type AnswerState,
  type CheckableSubject,
} from "./answer-state";

// 上: on'yomi primary, kun'yomi alternates.
const ue: CheckableSubject = {
  type: "kanji",
  meanings: [{ text: "above", primary: true }],
  readings: [
    { text: "じょう", kind: "onyomi", primary: true },
    { text: "うえ", kind: "kunyomi", primary: false },
  ],
  synonyms: ["over"],
};
const none = new Set<string>();
const typed = (input: string): AnswerState => ({ ...initialAnswer, input });

describe("answer state (spec 0007 AC-7, AC-9, AC-10)", () => {
  it("shakes with a hint for the other kind, keeping the converted text and judging nothing", () => {
    const { state, counted } = checkAnswer(typed("うe"), "reading", ue, none);
    expect(counted).toBe(false);
    expect(state).toMatchObject({ input: "うえ", verdict: null, hint: "Looking for the on'yomi" });
    expect(state.shakeKey).toBe(1);
  });

  it("finishes a trailing n before checking, and keeps it in the field", () => {
    const { state } = checkAnswer(typed("じょうn"), "reading", ue, none);
    expect(state.input).toBe("じょうん");
  });

  it("asks for the right script without a verdict", () => {
    expect(checkAnswer(typed("kyx"), "reading", ue, none).state.hint).toBe(
      "Type the reading in kana",
    );
    expect(checkAnswer(typed("うえ"), "meaning", ue, none).state.hint).toBe(
      "Type the meaning in English",
    );
  });

  it("clears the hint on edit, keeps it on an empty submit, and checks again on resubmit", () => {
    const shaken = checkAnswer(typed("うえ"), "reading", ue, none).state;
    expect(checkAnswer({ ...shaken, input: " " }, "reading", ue, none).state.hint).toBe(
      "Looking for the on'yomi",
    );
    expect(editAnswer(shaken, "じ").hint).toBeNull();
    const again = checkAnswer(shaken, "reading", ue, none).state;
    expect(again.shakeKey).toBe(2);
  });

  it("does nothing for punctuation only", () => {
    const { state, counted } = checkAnswer(typed("?!"), "meaning", ue, none);
    expect(counted).toBe(false);
    expect(state).toMatchObject({ verdict: null, hint: null, shakeKey: 0 });
  });

  it("judges close as a verdict with the nearest meaning, and Next clears it", () => {
    const { state, counted } = checkAnswer(typed("abuve"), "meaning", ue, none);
    expect(counted).toBe(true);
    expect(state).toMatchObject({ verdict: "close", closeTo: "above", hint: null });
    expect(editAnswer(state, "x")).toBe(state);
    expect(clearAnswer(state)).toEqual({ ...initialAnswer, shakeKey: state.shakeKey });
  });

  it("accepts a synonym and judges wrong answers", () => {
    expect(checkAnswer(typed("over"), "meaning", ue, none).state.verdict).toBe("correct");
    expect(checkAnswer(typed("below"), "meaning", ue, none).state.verdict).toBe("wrong");
  });

  it("does not check again while a verdict shows", () => {
    const judged = checkAnswer(typed("above"), "meaning", ue, none).state;
    expect(checkAnswer(judged, "meaning", ue, none)).toEqual({ state: judged, counted: false });
  });
});
