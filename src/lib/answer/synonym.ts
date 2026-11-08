// Your own synonyms (spec 0009 AC-5). Pure: no DB, framework, or clock.
import type { Meaning } from "@/lib/types";

import { hasJapaneseScript, meaningForms, normalizeMeaning } from "./meaning";

export const SYNONYM_MAX_LENGTH = 64;
export const SYNONYMS_MAX = 8;

export type SynonymRefusal = "not_english" | "empty" | "too_long" | "duplicate" | "full";
export type SynonymCheck = { ok: true; value: string } | { ok: false; reason: SynonymRefusal };

// Trimmed, with inner runs of whitespace collapsed to one space.
export function cleanSynonym(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * Whether `text` can join this item's synonyms. Refused when the list is full, when it has
 * Japanese script (the meaning field never matches kana or kanji), when it normalizes to
 * nothing, when it is longer than 64 characters, or when any of its forms equals a form of a
 * meaning or of a current synonym ("run" is refused when "to run" is a meaning).
 */
export function checkSynonym(
  text: string,
  meanings: readonly Meaning[],
  synonyms: readonly string[],
): SynonymCheck {
  const value = cleanSynonym(text);
  if (synonyms.length >= SYNONYMS_MAX) return { ok: false, reason: "full" };
  if (hasJapaneseScript(value)) return { ok: false, reason: "not_english" };
  if (normalizeMeaning(value) === "") return { ok: false, reason: "empty" };
  if (value.length > SYNONYM_MAX_LENGTH) return { ok: false, reason: "too_long" };

  const taken = new Set([...meanings.map((m) => m.text), ...synonyms].flatMap(meaningForms));
  if (meaningForms(value).some((f) => taken.has(f))) return { ok: false, reason: "duplicate" };
  return { ok: true, value };
}

// The message under the field for each refusal (AC-5).
export const synonymRefusalMessage: Record<SynonymRefusal, string> = {
  not_english: "Type an English meaning",
  empty: "Type an English meaning",
  too_long: `Use ${SYNONYM_MAX_LENGTH} characters or fewer`,
  duplicate: "Already accepted",
  full: `You can add up to ${SYNONYMS_MAX} synonyms`,
};
