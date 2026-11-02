import { describe, expect, it } from "vitest";

import {
  answerCurrent,
  createQueue,
  currentQuestion,
  dropItem,
  questionsFor,
  remainingItems,
  type QueueState,
} from "./queue";

// random() = 0.999... keeps Fisher Yates from swapping, so the order is the input order.
const noShuffle = () => 0.999999;

const items = [
  { subjectId: 1, questions: questionsFor("radical") },
  { subjectId: 2, questions: questionsFor("kanji") },
];

describe("createQueue", () => {
  it("puts every question of every item in one queue", () => {
    const state = createQueue(items, noShuffle);
    expect(state.pending).toEqual([
      { subjectId: 1, kind: "meaning" },
      { subjectId: 2, kind: "meaning" },
      { subjectId: 2, kind: "reading" },
    ]);
    expect(remainingItems(state)).toBe(2);
  });

  it("shuffles with the injected random function, repeatably", () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const a = createQueue(items, random).pending;
    seed = 1;
    const b = createQueue(items, random).pending;
    expect(a).toEqual(b);
    expect(createQueue(items, () => 0).pending).not.toEqual(createQueue(items, noShuffle).pending);
  });
});

describe("answerCurrent", () => {
  it("moves a wrong question to the end and counts every wrong submission", () => {
    let state: QueueState = createQueue(items, noShuffle);
    ({ state } = answerCurrent(state, true)); // 1 meaning, item 1 done
    ({ state } = answerCurrent(state, false)); // 2 meaning wrong
    expect(state.pending.map((q) => q.kind)).toEqual(["reading", "meaning"]);
    ({ state } = answerCurrent(state, false)); // 2 reading wrong
    ({ state } = answerCurrent(state, false)); // 2 meaning wrong again
    expect(state.items[2]).toMatchObject({ wrongMeaning: 2, wrongReading: 1 });
  });

  it("completes an item only when all its questions are right", () => {
    let state = createQueue(items, noShuffle);
    let result = answerCurrent(state, true);
    expect(result.completed).toEqual({ subjectId: 1, wrongMeaning: 0, wrongReading: 0 });
    state = result.state;

    result = answerCurrent(state, true); // 2 meaning
    expect(result.completed).toBeUndefined();
    result = answerCurrent(result.state, false); // 2 reading wrong
    result = answerCurrent(result.state, true); // 2 reading right
    expect(result.completed).toEqual({ subjectId: 2, wrongMeaning: 0, wrongReading: 1 });
    expect(currentQuestion(result.state)).toBeUndefined();
    expect(result.state.completedCount).toBe(2);
    expect(remainingItems(result.state)).toBe(0);
  });

  it("does nothing on an empty queue", () => {
    const empty = createQueue([], noShuffle);
    expect(answerCurrent(empty, true)).toEqual({ state: empty });
  });
});

describe("dropItem", () => {
  it("removes an item's remaining questions and leaves the rest", () => {
    const state = dropItem(createQueue(items, noShuffle), 2);
    expect(state.pending).toEqual([{ subjectId: 1, kind: "meaning" }]);
    expect(remainingItems(state)).toBe(1);
    expect(state.completedCount).toBe(0);
  });
});
