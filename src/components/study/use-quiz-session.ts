import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

import { useToast } from "@/components/ui";
import type { SubjectSummary } from "@/lib/db/queries/subjects";
import {
  accuracy,
  answerCurrent,
  createQueue,
  currentQuestion,
  dropItem,
  questionsFor,
  remainingItems,
  setWrapUp,
  waitingCount,
  type CompletedItem,
  type Question,
} from "@/lib/study/queue";
import type { ServiceError, ServiceResult } from "@/lib/study/result";

import {
  checkAnswer,
  clearAnswer,
  editAnswer,
  initialAnswer,
  type AnswerState,
  type QuizVerdict,
} from "./answer-state";

// A subject in play, with your synonyms for it from `user_notes` (spec 0007 AC-12).
export type QuizSubject = Pick<
  SubjectSummary,
  "id" | "type" | "characters" | "meanings" | "readings"
> & { synonyms: string[] };

// What the screen's save step returns: a service result (`R` when saved), or a thrown DB failure.
export type SaveItem<R extends { ok: true } = { ok: true }> = (
  item: CompletedItem,
) => Promise<ServiceResult<R, ServiceError>>;

// One saved item and what its service returned, in the order the items finished.
export type SavedItem<R extends { ok: true } = { ok: true }> = { item: CompletedItem; result: R };

const errorMessages: Record<ServiceError, string> = {
  not_due: "That item is not due any more, so it was skipped.",
  not_found: "That item no longer exists, so it was skipped.",
  not_pending: "That lesson was already done, so it was skipped.",
};

export type QuizSession<R extends { ok: true } = { ok: true }> = {
  question: Question | undefined;
  subject: QuizSubject | undefined;
  input: string;
  setInput: (text: string) => void;
  verdict: QuizVerdict | null;
  // A shake hint for an answer that does not count, keyed by `shakeKey` (spec 0007 AC-7, AC-8).
  hint: string | null;
  shakeKey: number;
  // The nearest meaning's original text after a "Close enough" answer (spec 0007 AC-9).
  closeTo: string | null;
  submit: () => void;
  // Items not yet completed: in play plus waiting, or in play only while wrapping up.
  remaining: number;
  saved: number;
  results: SavedItem<R>[];
  // Whole percent of questions right on their first answer; null before the first answer.
  accuracy: number | null;
  // Items still waiting to join the window.
  waiting: number;
  wrappingUp: boolean;
  // Wrap up (or Keep going) is offered while items wait or wrap up is on.
  canWrapUp: boolean;
  toggleWrapUp: () => void;
  answeredAny: boolean;
  saving: boolean;
  done: boolean;
};

/**
 * Drives one lesson quiz or review session (spec 0004 AC-7 to AC-10, spec 0006 AC-6 to AC-8).
 * The first submit checks the answer, the second moves on. When an item's last question is
 * right, `save` writes it; a failed write shows a toast and drops the item, and is never retried
 * (0004 AC-9). With `windowSize`, at most that many items are in play and the rest join as items
 * finish; without it every item is in play at once. Answers are checked per spec 0007:
 * `close` counts as right, and `wrong_kind` or `invalid` only shake with a hint.
 */
export function useQuizSession<R extends { ok: true } = { ok: true }>(
  subjects: QuizSubject[],
  save: SaveItem<R>,
  options: { windowSize?: number; courseForms: ReadonlySet<string> },
): QuizSession<R> {
  const toast = useToast();
  const [byId] = useState(() => new Map(subjects.map((s) => [s.id, s])));
  const [queue, setQueue] = useState(() =>
    createQueue(
      subjects.map((s) => ({ subjectId: s.id, questions: questionsFor(s.type) })),
      Math.random,
      { windowSize: options.windowSize },
    ),
  );
  const [answer, setAnswer] = useState<AnswerState>(initialAnswer);
  const [results, setResults] = useState<SavedItem<R>[]>([]);
  const [answeredAny, setAnsweredAny] = useState(false);
  const [saving, setSaving] = useState(false);

  const question = currentQuestion(queue);
  const done = !question && !saving;
  // The answer field unmounts with the last question; close its keyboard too.
  useEffect(() => {
    if (done) Keyboard.dismiss();
  }, [done]);
  const subject = question ? byId.get(question.subjectId) : undefined;

  // The answer is frozen while its result shows; editing clears a hint.
  function setInput(text: string) {
    setAnswer((a) => editAnswer(a, text));
  }

  async function persist(item: CompletedItem) {
    setSaving(true);
    try {
      const result = await save(item);
      if (result.ok) {
        setResults((rows) => [...rows, { item, result }]);
      } else {
        toast.show(errorMessages[result.error], { tone: "error" });
        setQueue((s) => dropItem(s, item.subjectId));
      }
    } catch (e) {
      toast.show(e instanceof Error ? `Could not save: ${e.message}` : "Could not save", {
        tone: "error",
      });
      setQueue((s) => dropItem(s, item.subjectId));
    } finally {
      setSaving(false);
    }
  }

  function submit() {
    if (!question || !subject || saving) return;
    if (answer.verdict === null) {
      const checked = checkAnswer(answer, question.kind, subject, options.courseForms);
      setAnswer(checked.state);
      if (checked.counted) setAnsweredAny(true);
      return;
    }
    const { state, completed } = answerCurrent(queue, answer.verdict !== "wrong");
    setQueue(state);
    setAnswer(clearAnswer(answer));
    if (completed) void persist(completed);
  }

  function toggleWrapUp() {
    setQueue((s) => setWrapUp(s, !s.wrappingUp));
  }

  const waiting = waitingCount(queue);
  return {
    question,
    subject,
    input: answer.input,
    setInput,
    verdict: answer.verdict,
    hint: answer.hint,
    shakeKey: answer.shakeKey,
    closeTo: answer.closeTo,
    submit,
    remaining: remainingItems(queue),
    saved: results.length,
    results,
    accuracy: accuracy(queue),
    waiting,
    wrappingUp: queue.wrappingUp,
    canWrapUp: waiting > 0 || queue.wrappingUp,
    toggleWrapUp,
    answeredAny,
    saving,
    done,
  };
}
