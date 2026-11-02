// Exact answer checks for the core loop (spec 0004 AC-10). Forgiving checks come with 0007.
// Pure: no DB, framework, or clock.
import type { Meaning, Reading } from "@/lib/types";

export type Verdict = "correct" | "wrong";

// Trimmed, lowercased input equals any meaning, lowercased.
export function checkMeaning(input: string, subject: { meanings: Meaning[] }): Verdict {
  const answer = input.trim().toLowerCase();
  if (!answer) return "wrong";
  return subject.meanings.some((m) => m.text.toLowerCase() === answer) ? "correct" : "wrong";
}

// Input (already hiragana from the IME conversion) equals a primary reading.
export function checkReading(input: string, subject: { readings: Reading[] }): Verdict {
  const answer = input.trim();
  if (!answer) return "wrong";
  return subject.readings.some((r) => r.primary && r.text === answer) ? "correct" : "wrong";
}

// What a wrong answer shows: every meaning, or the primary readings only (spec 0004 Value sourcing).
export function acceptedAnswers(
  kind: "meaning" | "reading",
  subject: { meanings: Meaning[]; readings: Reading[] },
): string[] {
  return kind === "meaning"
    ? subject.meanings.map((m) => m.text)
    : subject.readings.filter((r) => r.primary).map((r) => r.text);
}
