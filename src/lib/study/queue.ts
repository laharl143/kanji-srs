// In memory session queue for the lesson quiz and reviews (spec 0004 Feature design; the review
// window, wrap up, and accuracy are spec 0006 AC-6 to AC-8). Pure: shuffles and joins take the
// injected `random`, so tests are repeatable.

// A typed question asks for the meaning or the reading; an Anki card (spec 0012) asks for both at
// once and is graded by you.
export type TypedKind = "meaning" | "reading";
export type QuestionKind = TypedKind | "card";
export type StudyMode = "typed" | "anki";
export type QueueItem = { subjectId: number; questions: QuestionKind[] };
export type Question = { subjectId: number; kind: QuestionKind };
export type CompletedItem = { subjectId: number; wrongMeaning: number; wrongReading: number };

// Reviews keep at most this many items in play, so at most this many are ever half done.
export const REVIEW_WINDOW_SIZE = 10;

type ItemProgress = {
  left: QuestionKind[];
  // Question kinds answered at least once, so only a question's first answer counts as a try.
  tried: QuestionKind[];
  wrongMeaning: number;
  wrongReading: number;
};

export type QueueState = {
  // Questions of the items in play still to answer; the first one is current.
  pending: Question[];
  // Items in play (at least one question left), by subject id.
  items: Record<number, ItemProgress>;
  // Items that have not joined yet, in the order they will join.
  waiting: QueueItem[];
  // The most items in play at once.
  windowSize: number;
  // While on, no new item joins.
  wrappingUp: boolean;
  completedCount: number;
  // Questions answered at least once, and how many of them were right on the first answer.
  answered: number;
  firstTryRight: number;
  // Kept so later joins use the same injected random as the start.
  random: () => number;
};

function shuffle<T>(rows: readonly T[], random: () => number): T[] {
  const out = [...rows];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function questionsOf(item: QueueItem): Question[] {
  return item.questions.map((kind) => ({ subjectId: item.subjectId, kind }));
}

function progressOf(item: QueueItem): ItemProgress {
  return { left: [...item.questions], tried: [], wrongMeaning: 0, wrongReading: 0 };
}

/**
 * Starts a session. The items go in a random order, and the first `windowSize` of them are in
 * play with their questions shuffled together; the rest wait to join. Without `windowSize`
 * every item is in play at once, as the lesson quiz wants.
 */
export function createQueue(
  items: QueueItem[],
  random: () => number,
  options: { windowSize?: number } = {},
): QueueState {
  const order = shuffle(
    items.filter((i) => i.questions.length > 0),
    random,
  );
  const windowSize = Math.max(1, options.windowSize ?? order.length);
  const inPlay = order.slice(0, windowSize);
  const progress: Record<number, ItemProgress> = {};
  for (const i of inPlay) progress[i.subjectId] = progressOf(i);
  return {
    pending: shuffle(inPlay.flatMap(questionsOf), random),
    items: progress,
    waiting: order.slice(windowSize),
    windowSize,
    wrappingUp: false,
    completedCount: 0,
    answered: 0,
    firstTryRight: 0,
    random,
  };
}

// Brings waiting items into play until the window is full. Each new question goes to a random
// position at or after `from` among the pending ones, one random() draw per question.
function fillWindow(state: QueueState, from: number): QueueState {
  let inPlay = Object.keys(state.items).length;
  if (state.waiting.length === 0 || inPlay >= state.windowSize) return state;
  const pending = [...state.pending];
  const items = { ...state.items };
  const waiting = [...state.waiting];
  while (inPlay < state.windowSize && waiting.length > 0) {
    const next = waiting.shift()!;
    items[next.subjectId] = progressOf(next);
    inPlay += 1;
    for (const question of questionsOf(next)) {
      const start = Math.min(from, pending.length);
      const at = start + Math.floor(state.random() * (pending.length - start + 1));
      pending.splice(at, 0, question);
    }
  }
  return { ...state, pending, items, waiting };
}

export function currentQuestion(state: QueueState): Question | undefined {
  return state.pending[0];
}

// Items not yet completed (the header count): in play plus waiting, or only the items in play
// while wrapping up.
export function remainingItems(state: QueueState): number {
  return Object.keys(state.items).length + (state.wrappingUp ? 0 : state.waiting.length);
}

// Items still waiting to join; the review screen offers Wrap up while there are any.
export function waitingCount(state: QueueState): number {
  return state.waiting.length;
}

/**
 * Answers the current question. Wrong: 1 is added to that item's count for the question type and
 * the question moves to the end of the queue. Right: the question leaves the queue, and at the
 * item's last right answer `completed` comes back, the item leaves play, and (unless wrapping
 * up) the next waiting item joins right then. A question's first answer also counts toward
 * accuracy.
 */
export function answerCurrent(
  state: QueueState,
  correct: boolean,
): { state: QueueState; completed?: CompletedItem } {
  const [question, ...rest] = state.pending;
  if (!question) return { state };
  const item = state.items[question.subjectId];
  const first = !item.tried.includes(question.kind);
  const tried = first ? [...item.tried, question.kind] : item.tried;
  const counts = {
    answered: state.answered + (first ? 1 : 0),
    firstTryRight: state.firstTryRight + (first && correct ? 1 : 0),
  };

  if (!correct) {
    const updated: ItemProgress = {
      ...item,
      tried,
      // A missed card counts as one wrong meaning answer (spec 0012 AC-6).
      wrongMeaning: item.wrongMeaning + (question.kind !== "reading" ? 1 : 0),
      wrongReading: item.wrongReading + (question.kind === "reading" ? 1 : 0),
    };
    return {
      state: {
        ...state,
        ...counts,
        pending: [...rest, question],
        items: { ...state.items, [question.subjectId]: updated },
      },
    };
  }

  const left = item.left.filter((k) => k !== question.kind);
  if (left.length > 0) {
    return {
      state: {
        ...state,
        ...counts,
        pending: rest,
        items: { ...state.items, [question.subjectId]: { ...item, left, tried } },
      },
    };
  }
  const items = { ...state.items };
  delete items[question.subjectId];
  const finished: QueueState = {
    ...state,
    ...counts,
    pending: rest,
    items,
    completedCount: state.completedCount + 1,
  };
  return {
    state: finished.wrappingUp ? finished : fillWindow(finished, 0),
    completed: {
      subjectId: question.subjectId,
      wrongMeaning: item.wrongMeaning,
      wrongReading: item.wrongReading,
    },
  };
}

/**
 * Wrap up on: no new item joins, and the items in play finish as usual. Off again (Keep going):
 * the window fills back up at once from the waiting items, each question at a random position
 * after the one on screen; after that, items join as before.
 */
export function setWrapUp(state: QueueState, on: boolean): QueueState {
  if (on === state.wrappingUp) return state;
  if (on) return { ...state, wrappingUp: true };
  return fillWindow({ ...state, wrappingUp: false }, 1);
}

// Questions right on their first answer, as a whole percent of the questions answered at least
// once, rounded down so 100 means no misses. Null before the first answer.
export function accuracy(state: QueueState): number | null {
  if (state.answered === 0) return null;
  return Math.floor((state.firstTryRight * 100) / state.answered);
}

// Removes an item after a failed write (spec 0004 AC-9). Not counted as done, and it never
// brings in another item. Its answers still count toward accuracy.
export function dropItem(state: QueueState, subjectId: number): QueueState {
  const items = { ...state.items };
  delete items[subjectId];
  return {
    ...state,
    pending: state.pending.filter((q) => q.subjectId !== subjectId),
    items,
    waiting: state.waiting.filter((i) => i.subjectId !== subjectId),
  };
}

// Typed: meaning for every type, reading for kanji and vocab (0001 §6.3). Anki mode: one card per
// item (spec 0012).
export function questionsFor(
  type: "radical" | "kanji" | "vocab",
  mode: StudyMode = "typed",
): QuestionKind[] {
  if (mode === "anki") return ["card"];
  return type === "radical" ? ["meaning"] : ["meaning", "reading"];
}
