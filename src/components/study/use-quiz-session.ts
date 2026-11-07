import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

import { useToast } from "@/components/ui";
import { checkMeaning, checkReading, type Verdict } from "@/lib/answer/check";
import { finishReadingInput } from "@/lib/answer/kana";
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

export type QuizSubject = Pick<
  SubjectSummary,
  "id" | "type" | "characters" | "meanings" | "readings"
>;

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
  verdict: Verdict | null;
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
 * finish; without it every item is in play at once.
 */
export function useQuizSession<R extends { ok: true } = { ok: true }>(
  subjects: QuizSubject[],
  save: SaveItem<R>,
  options: { windowSize?: number } = {},
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
  const [input, setInputState] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
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

  // The answer is frozen while its result shows.
  function setInput(text: string) {
    if (verdict === null) setInputState(text);
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
    if (verdict === null) {
      if (input.trim() === "") return;
      const answer = question.kind === "reading" ? finishReadingInput(input) : input;
      setInputState(answer);
      setVerdict(
        question.kind === "meaning" ? checkMeaning(answer, subject) : checkReading(answer, subject),
      );
      setAnsweredAny(true);
      return;
    }
    const { state, completed } = answerCurrent(queue, verdict === "correct");
    setQueue(state);
    setVerdict(null);
    setInputState("");
    if (completed) void persist(completed);
  }

  function toggleWrapUp() {
    setQueue((s) => setWrapUp(s, !s.wrappingUp));
  }

  const waiting = waitingCount(queue);
  return {
    question,
    subject,
    input,
    setInput,
    verdict,
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
