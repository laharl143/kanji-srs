// Answer checks (spec 0007). Pure: no DB, framework, or clock. Synonyms and the course word
// forms are passed in by the caller.
import type { Meaning, Reading, SubjectType } from "@/lib/types";

import { editDistance } from "./distance";
import { isHiraganaOnly, normalizeReading } from "./kana";
import { digitsOf, hasJapaneseScript, inputForms, meaningForms, tolerance } from "./meaning";

export type AnswerResult =
  | { result: "correct" }
  | { result: "close"; expected: string }
  | { result: "wrong" }
  | { result: "wrong_kind"; wanted: "onyomi" | "kunyomi" }
  | { result: "invalid"; wanted: "kana" | "english" }
  | { result: "empty" };

type Accepted = { form: string; text: string; primary: boolean; order: number };

/**
 * Japanese script → invalid; nothing left after normalization → empty; an exact form match →
 * correct; another course word → wrong; the nearest form within tolerance with the same digits
 * → close; else wrong (AC-1 to AC-3, AC-6, AC-10).
 */
export function checkMeaning(
  input: string,
  subject: { meanings: Meaning[] },
  synonyms: readonly string[],
  courseForms: ReadonlySet<string>,
): AnswerResult {
  if (hasJapaneseScript(input)) return { result: "invalid", wanted: "english" };
  const typed = inputForms(input);
  if (typed.length === 0) return { result: "empty" };

  const sources = [
    ...subject.meanings.map((m) => ({ text: m.text, primary: m.primary })),
    ...synonyms.map((text) => ({ text, primary: false })),
  ];
  const accepted: Accepted[] = sources.flatMap((s, order) =>
    meaningForms(s.text).map((form) => ({ form, text: s.text, primary: s.primary, order })),
  );

  if (typed.some((t) => accepted.some((a) => a.form === t))) return { result: "correct" };
  if (typed.some((t) => courseForms.has(t))) return { result: "wrong" };

  let best: { distance: number; a: Accepted } | undefined;
  for (const t of typed) {
    for (const a of accepted) {
      if (digitsOf(t) !== digitsOf(a.form)) continue;
      const distance = editDistance(t, a.form);
      if (distance > tolerance([...a.form].length)) continue;
      if (!best || isBetter(distance, a, best)) best = { distance, a };
    }
  }
  return best ? { result: "close", expected: best.a.text } : { result: "wrong" };
}

// Smaller distance, then a primary meaning, then list order (meanings before synonyms).
function isBetter(distance: number, a: Accepted, best: { distance: number; a: Accepted }) {
  if (distance !== best.distance) return distance < best.distance;
  if (a.primary !== best.a.primary) return a.primary;
  return a.order < best.a.order;
}

/**
 * Empty → empty; anything but hiragana after normalization → invalid; an accepted reading →
 * correct (kanji: primary readings, vocab: every reading); a kanji reading of the other kind →
 * wrong_kind; else wrong (AC-4 to AC-6).
 */
export function checkReading(
  input: string,
  subject: { type: SubjectType; readings: Reading[] },
): AnswerResult {
  const answer = normalizeReading(input);
  if (answer === "") return { result: "empty" };
  if (!isHiraganaOnly(answer)) return { result: "invalid", wanted: "kana" };

  const matches = (r: Reading) => normalizeReading(r.text) === answer;
  const accepted =
    subject.type === "kanji" ? subject.readings.filter((r) => r.primary) : subject.readings;
  if (accepted.some(matches)) return { result: "correct" };

  if (subject.type === "kanji") {
    const wanted = subject.readings.find((r) => r.primary)?.kind;
    if (wanted && subject.readings.some((r) => r.kind && r.kind !== wanted && matches(r))) {
      return { result: "wrong_kind", wanted };
    }
  }
  return { result: "wrong" };
}

// What a wrong answer shows (AC-11): every meaning then your synonyms; for readings, a kanji's
// primary readings, or every vocab reading with the primary ones first.
export function acceptedAnswers(
  kind: "meaning" | "reading",
  subject: { type: SubjectType; meanings: Meaning[]; readings: Reading[] },
  synonyms: readonly string[],
): string[] {
  if (kind === "meaning") return [...subject.meanings.map((m) => m.text), ...synonyms];
  if (subject.type === "kanji") return subject.readings.filter((r) => r.primary).map((r) => r.text);
  return [
    ...subject.readings.filter((r) => r.primary),
    ...subject.readings.filter((r) => !r.primary),
  ].map((r) => r.text);
}
