// In memory session queue for the lesson quiz and reviews (spec 0004 Feature design).
// Pure: the shuffle takes an injected `random`, so tests are repeatable.

export type QuestionKind = "meaning" | "reading";
export type QueueItem = { subjectId: number; questions: QuestionKind[] };
export type Question = { subjectId: number; kind: QuestionKind };
export type CompletedItem = { subjectId: number; wrongMeaning: number; wrongReading: number };

type ItemProgress = { left: QuestionKind[]; wrongMeaning: number; wrongReading: number };

export type QueueState = {
  // Questions still to answer; the first one is current.
  pending: Question[];
  // Items with at least one question left, by subject id.
  items: Record<number, ItemProgress>;
  completedCount: number;
};

export function createQueue(items: QueueItem[], random: () => number): QueueState {
  const pending: Question[] = items.flatMap((i) =>
    i.questions.map((kind) => ({ subjectId: i.subjectId, kind })),
  );
  // Fisher Yates shuffle, all items' questions together.
  for (let i = pending.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }
  const progress: Record<number, ItemProgress> = {};
  for (const i of items) {
    if (i.questions.length > 0) {
      progress[i.subjectId] = { left: [...i.questions], wrongMeaning: 0, wrongReading: 0 };
    }
  }
  return { pending, items: progress, completedCount: 0 };
}

export function currentQuestion(state: QueueState): Question | undefined {
  return state.pending[0];
}

// Items not yet completed in this session (the review header count).
export function remainingItems(state: QueueState): number {
  return Object.keys(state.items).length;
}

/**
 * Answers the current question. Correct: the question leaves the queue, and `completed` comes
 * back the moment the item's last question is right. Wrong: 1 is added to that item's count for
 * the question type and the question moves to the end of the queue.
 */
export function answerCurrent(
  state: QueueState,
  correct: boolean,
): { state: QueueState; completed?: CompletedItem } {
  const [question, ...rest] = state.pending;
  if (!question) return { state };
  const item = state.items[question.subjectId];

  if (!correct) {
    const updated: ItemProgress = {
      ...item,
      wrongMeaning: item.wrongMeaning + (question.kind === "meaning" ? 1 : 0),
      wrongReading: item.wrongReading + (question.kind === "reading" ? 1 : 0),
    };
    return {
      state: {
        ...state,
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
        pending: rest,
        items: { ...state.items, [question.subjectId]: { ...item, left } },
      },
    };
  }
  const items = { ...state.items };
  delete items[question.subjectId];
  return {
    state: { pending: rest, items, completedCount: state.completedCount + 1 },
    completed: {
      subjectId: question.subjectId,
      wrongMeaning: item.wrongMeaning,
      wrongReading: item.wrongReading,
    },
  };
}

// Removes an item's remaining questions (a failed write, spec 0004 AC-9). Not counted as done.
export function dropItem(state: QueueState, subjectId: number): QueueState {
  const items = { ...state.items };
  delete items[subjectId];
  return { ...state, pending: state.pending.filter((q) => q.subjectId !== subjectId), items };
}

// Meaning for every type, reading for kanji and vocab (0001 §6.3).
export function questionsFor(type: "radical" | "kanji" | "vocab"): QuestionKind[] {
  return type === "radical" ? ["meaning"] : ["meaning", "reading"];
}
