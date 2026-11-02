import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

import { useToast } from "@/components/ui";
import { checkMeaning, checkReading, type Verdict } from "@/lib/answer/check";
import { finishReadingInput } from "@/lib/answer/kana";
import type { SubjectSummary } from "@/lib/db/queries/subjects";
import {
  answerCurrent,
  createQueue,
  currentQuestion,
  dropItem,
  questionsFor,
  remainingItems,
  type CompletedItem,
  type Question,
} from "@/lib/study/queue";
import type { ServiceError } from "@/lib/study/result";

export type QuizSubject = Pick<
  SubjectSummary,
  "id" | "type" | "characters" | "meanings" | "readings"
>;

// What the screen's save step returns: a service result, or a thrown DB failure.
export type SaveItem = (
  item: CompletedItem,
) => Promise<{ ok: true } | { ok: false; error: ServiceError }>;

const errorMessages: Record<ServiceError, string> = {
  not_due: "That item is not due any more, so it was skipped.",
  not_found: "That item no longer exists, so it was skipped.",
  not_pending: "That lesson was already done, so it was skipped.",
};

export type QuizSession = {
  question: Question | undefined;
  subject: QuizSubject | undefined;
  input: string;
  setInput: (text: string) => void;
  verdict: Verdict | null;
  submit: () => void;
  remaining: number;
  saved: number;
  answeredAny: boolean;
  saving: boolean;
  done: boolean;
};

/**
 * Drives one lesson quiz or review session (spec 0004 AC-7 to AC-10). The first submit checks
 * the answer, the second moves on. When an item's last question is right, `save` writes it;
 * a failed write shows a toast and drops the item, and is never retried (AC-9).
 */
export function useQuizSession(subjects: QuizSubject[], save: SaveItem): QuizSession {
  const toast = useToast();
  const [byId] = useState(() => new Map(subjects.map((s) => [s.id, s])));
  const [queue, setQueue] = useState(() =>
    createQueue(
      subjects.map((s) => ({ subjectId: s.id, questions: questionsFor(s.type) })),
      Math.random,
    ),
  );
  const [input, setInputState] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [saved, setSaved] = useState(0);
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
        setSaved((n) => n + 1);
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

  return {
    question,
    subject,
    input,
    setInput,
    verdict,
    submit,
    remaining: remainingItems(queue),
    saved,
    answeredAny,
    saving,
    done,
  };
}
