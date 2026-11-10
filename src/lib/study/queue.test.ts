import { describe, expect, it } from "vitest";

import { newStage } from "@/lib/srs/schedule";

import {
  REVIEW_WINDOW_SIZE,
  accuracy,
  answerCurrent,
  createQueue,
  currentQuestion,
  dropItem,
  questionsFor,
  remainingItems,
  setWrapUp,
  waitingCount,
  type QueueItem,
  type QueueState,
} from "./queue";

// random() = 0.999... keeps Fisher Yates from swapping, so the order is the input order, and
// puts a joining question at the end.
const noShuffle = () => 0.999999;

// A repeatable random() in [0, 1) (Park and Miller).
function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const radicals = (n: number, first = 1): QueueItem[] =>
  Array.from({ length: n }, (_, i) => ({
    subjectId: first + i,
    questions: questionsFor("radical"),
  }));
const kanji = (n: number, first: number): QueueItem[] =>
  Array.from({ length: n }, (_, i) => ({ subjectId: first + i, questions: questionsFor("kanji") }));
const inPlay = (state: QueueState) =>
  Object.keys(state.items)
    .map(Number)
    .sort((a, b) => a - b);

// Answers right until the next item finishes.
function finishNext(state: QueueState): { state: QueueState; completed: { subjectId: number } } {
  for (;;) {
    const result = answerCurrent(state, true);
    state = result.state;
    if (result.completed) return { state, completed: result.completed };
    if (!currentQuestion(state)) throw new Error("no item finished");
  }
}

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

describe("review window (spec 0006 AC-6)", () => {
  // 25 due items: 15 radicals (one question each) and 10 kanji (two each).
  const due = [...radicals(15), ...kanji(10, 100)];
  const window = { windowSize: REVIEW_WINDOW_SIZE };

  it("keeps 10 of 25 items in play, their questions shuffled together, and counts all 25", () => {
    const state = createQueue(due, seeded(7), window);
    expect(inPlay(state)).toHaveLength(10);
    expect(waitingCount(state)).toBe(15);
    expect(remainingItems(state)).toBe(25);
    // Only the questions of the items in play are queued.
    expect([...new Set(state.pending.map((q) => q.subjectId))].sort((a, b) => a - b)).toEqual(
      inPlay(state),
    );
    const questions = inPlay(state).reduce((n, id) => n + (id >= 100 ? 2 : 1), 0);
    expect(state.pending).toHaveLength(questions);
  });

  it("puts the items in a random order from the injected random, repeatably", () => {
    const a = createQueue(due, seeded(7), window);
    const b = createQueue(due, seeded(7), window);
    expect(a.pending).toEqual(b.pending);
    expect(a.waiting).toEqual(b.waiting);
    const first10 = due.slice(0, 10).map((i) => i.subjectId);
    expect(inPlay(createQueue(due, noShuffle, window))).toEqual(first10);
    expect(inPlay(a)).not.toEqual(first10);
  });

  it("brings in the next waiting item when one finishes, at repeatable random positions", () => {
    const run = () => {
      const start = createQueue(due, seeded(3), window);
      return { next: start.waiting[0].subjectId, ...finishNext(start) };
    };
    const { next, state, completed } = run();

    expect(state.items[completed.subjectId]).toBeUndefined();
    expect(state.items[next]).toBeDefined();
    expect(inPlay(state)).toHaveLength(10);
    expect(waitingCount(state)).toBe(14);
    expect(remainingItems(state)).toBe(24);
    expect(run().state.pending).toEqual(state.pending);
  });

  it("draws random() once per question of the joining item, for its position", () => {
    let draw = noShuffle;
    let draws = 0;
    const random = () => {
      draws += 1;
      return draw();
    };
    // Radicals 1 and 2 in play, kanji 100 waiting.
    let state = createQueue([...radicals(2), ...kanji(1, 100)], random, { windowSize: 2 });
    draws = 0;
    draw = () => 0; // the front of the pending questions

    ({ state } = answerCurrent(state, true)); // radical 1 finishes, kanji 100 joins

    expect(draws).toBe(2);
    expect(state.pending).toEqual([
      { subjectId: 100, kind: "reading" },
      { subjectId: 100, kind: "meaning" },
      { subjectId: 2, kind: "meaning" },
    ]);
  });

  it("brings in nothing more when the finished item's save then fails", () => {
    const { state, completed } = finishNext(createQueue(due, seeded(3), window));
    const dropped = dropItem(state, completed.subjectId);
    expect(dropped.pending).toEqual(state.pending);
    expect(inPlay(dropped)).toEqual(inPlay(state));
    expect(waitingCount(dropped)).toBe(14);
  });

  it("still moves a wrong question to the end", () => {
    const start = createQueue(due, seeded(3), window);
    const { state } = answerCurrent(start, false);
    expect(state.pending.at(-1)).toEqual(currentQuestion(start));
    expect(state.pending).toHaveLength(start.pending.length);
    expect(remainingItems(state)).toBe(25);
  });

  it("finishes every item exactly once with never more than 10 in play", () => {
    let state = createQueue(due, seeded(11), window);
    const finished: number[] = [];
    while (currentQuestion(state)) {
      expect(inPlay(state).length).toBeLessThanOrEqual(10);
      const result = answerCurrent(state, true);
      state = result.state;
      if (result.completed) {
        finished.push(result.completed.subjectId);
        expect(remainingItems(state)).toBe(25 - finished.length);
      }
    }
    expect(finished.sort((a, b) => a - b)).toEqual(due.map((i) => i.subjectId));
  });

  it("keeps the whole batch in play without a window, as the lesson quiz does", () => {
    const state = createQueue(due, seeded(3));
    expect(inPlay(state)).toHaveLength(25);
    expect(waitingCount(state)).toBe(0);
    expect(state.pending).toHaveLength(35);
  });
});

describe("wrap up (spec 0006 AC-7)", () => {
  const due = radicals(25);
  const window = { windowSize: REVIEW_WINDOW_SIZE };

  it("stops new items from joining, and the count shows only the items in play", () => {
    let state = setWrapUp(createQueue(due, seeded(2), window), true);
    expect(state.wrappingUp).toBe(true);
    expect(remainingItems(state)).toBe(10);

    ({ state } = finishNext(state));

    expect(inPlay(state)).toHaveLength(9);
    expect(remainingItems(state)).toBe(9);
    expect(waitingCount(state)).toBe(15);
  });

  it("Keep going fills the window back to 10 at once, after the question on screen", () => {
    let draw = seeded(2);
    const random = () => draw();
    let state = setWrapUp(createQueue(due, random, window), true);
    for (let i = 0; i < 4; i++) ({ state } = finishNext(state));
    const onScreen = currentQuestion(state);
    const joining = state.waiting.slice(0, 4).map((i) => i.subjectId);

    draw = () => 0; // asks for the very front each time
    state = setWrapUp(state, false);

    expect(state.wrappingUp).toBe(false);
    expect(currentQuestion(state)).toEqual(onScreen);
    expect(state.pending.slice(1, 5).map((q) => q.subjectId)).toEqual([...joining].reverse());
    expect(inPlay(state)).toHaveLength(10);
    expect(waitingCount(state)).toBe(11);
    expect(remainingItems(state)).toBe(21);

    // After that, items join one for one again.
    draw = seeded(5);
    ({ state } = finishNext(state));
    expect(inPlay(state)).toHaveLength(10);
    expect(waitingCount(state)).toBe(10);
  });

  it("ends the session when the last item in play finishes, leaving the rest unanswered", () => {
    let state = setWrapUp(createQueue(due, seeded(2), window), true);
    const finished: number[] = [];
    while (currentQuestion(state)) {
      const result = answerCurrent(state, true);
      state = result.state;
      if (result.completed) finished.push(result.completed.subjectId);
    }
    expect(finished).toHaveLength(10);
    expect(remainingItems(state)).toBe(0);
    expect(waitingCount(state)).toBe(15);
    expect(state.waiting.some((i) => finished.includes(i.subjectId))).toBe(false);
  });

  it("keeps an item that joined during a save in play when wrap up starts", () => {
    const start = createQueue(due, seeded(2), window);
    const joined = start.waiting[0].subjectId;
    const state = setWrapUp(finishNext(start).state, true);
    expect(state.items[joined]).toBeDefined();
    expect(remainingItems(state)).toBe(10);
  });

  it("has nothing to wrap up with 10 or fewer items", () => {
    const state = createQueue(radicals(10), seeded(2), window);
    expect(waitingCount(state)).toBe(0);
    expect(remainingItems(state)).toBe(10);
  });

  it("returns the same state when wrap up is already in the asked state", () => {
    const state = createQueue(due, seeded(2), window);
    expect(setWrapUp(state, false)).toBe(state);
    const on = setWrapUp(state, true);
    expect(setWrapUp(on, true)).toBe(on);
  });
});

describe("accuracy (spec 0006 AC-8)", () => {
  it("is null before the first answer", () => {
    expect(accuracy(createQueue(radicals(3), noShuffle))).toBeNull();
  });

  it("counts a question once, and as right only when its first answer was right", () => {
    let state = createQueue(kanji(1, 1), noShuffle);
    ({ state } = answerCurrent(state, false)); // meaning wrong
    expect(accuracy(state)).toBe(0);
    ({ state } = answerCurrent(state, true)); // reading right
    expect(accuracy(state)).toBe(50);
    ({ state } = answerCurrent(state, true)); // meaning right on the second try
    expect(accuracy(state)).toBe(50);
    expect(state.answered).toBe(2);
  });

  it("rounds down, so 199 of 200 shows 99 and only no misses shows 100", () => {
    let state = createQueue(radicals(200), noShuffle);
    ({ state } = answerCurrent(state, false)); // radical 1 wrong, then right at the end
    while (currentQuestion(state)) ({ state } = answerCurrent(state, true));
    expect(accuracy(state)).toBe(99);

    let clean = createQueue(radicals(3), noShuffle);
    while (currentQuestion(clean)) ({ state: clean } = answerCurrent(clean, true));
    expect(accuracy(clean)).toBe(100);
  });

  it("keeps counting the answers to an item whose save then failed", () => {
    const result = answerCurrent(createQueue(radicals(2), noShuffle), true);
    const state = dropItem(result.state, result.completed!.subjectId);
    expect(accuracy(state)).toBe(100);
    expect(state.answered).toBe(1);
  });
});

describe("Anki mode cards (spec 0012)", () => {
  it("gives one card per item in Anki mode and the typed questions otherwise (AC-9)", () => {
    expect(questionsFor("radical", "anki")).toEqual(["card"]);
    expect(questionsFor("kanji", "anki")).toEqual(["card"]);
    expect(questionsFor("vocab", "anki")).toEqual(["card"]);
    expect(questionsFor("radical", "typed")).toEqual(["meaning"]);
    expect(questionsFor("kanji", "typed")).toEqual(["meaning", "reading"]);
    expect(questionsFor("kanji")).toEqual(["meaning", "reading"]);
  });

  const cards: QueueItem[] = [
    { subjectId: 1, questions: questionsFor("kanji", "anki") },
    { subjectId: 2, questions: questionsFor("vocab", "anki") },
  ];

  it("finishes a card on Got it with no misses (AC-5)", () => {
    const state = createQueue(cards, noShuffle);
    expect(state.pending).toEqual([
      { subjectId: 1, kind: "card" },
      { subjectId: 2, kind: "card" },
    ]);
    const result = answerCurrent(state, true);
    expect(result.completed).toEqual({ subjectId: 1, wrongMeaning: 0, wrongReading: 0 });
    expect(newStage(3, 0, 0)).toBe(4);
  });

  it("counts Missed as one wrong meaning answer and requeues the card (AC-6)", () => {
    let state = createQueue(cards, noShuffle);
    state = answerCurrent(state, false).state;
    expect(state.pending).toEqual([
      { subjectId: 2, kind: "card" },
      { subjectId: 1, kind: "card" },
    ]);
    expect(state.items[1]).toMatchObject({ wrongMeaning: 1, wrongReading: 0 });
    state = answerCurrent(state, true).state; // item 2
    const once = answerCurrent(state, true);
    expect(once.completed).toEqual({ subjectId: 1, wrongMeaning: 1, wrongReading: 0 });
    // One miss drops a stage 3 item one step, like one wrong typed answer.
    expect(newStage(3, 1, 0)).toBe(2);
  });

  it("counts two misses as two wrong answers, like two wrong typed answers (AC-6)", () => {
    let state = createQueue([cards[0]], noShuffle);
    state = answerCurrent(state, false).state;
    state = answerCurrent(state, false).state;
    const done = answerCurrent(state, true);
    expect(done.completed).toEqual({ subjectId: 1, wrongMeaning: 2, wrongReading: 0 });
    expect(newStage(3, 2, 0)).toBe(newStage(3, 1, 1));
  });

  it("counts a card once toward accuracy (AC-7)", () => {
    let state = createQueue(cards, noShuffle);
    state = answerCurrent(state, false).state; // 1 missed on first show
    state = answerCurrent(state, true).state; // 2 right first try
    state = answerCurrent(state, true).state; // 1 again, not a new try
    expect(state.answered).toBe(2);
    expect(state.firstTryRight).toBe(1);
    expect(accuracy(state)).toBe(50);
    expect(remainingItems(state)).toBe(0);
  });
});
