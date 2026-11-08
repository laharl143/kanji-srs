// Meaning forms and normalization (spec 0007 AC-1 to AC-3, AC-6). Pure: no DB, framework, or clock.
import type { Meaning } from "@/lib/types";

const leadingTo = /^\s*to\s+/i;
// Non greedy, so an unclosed bracket is left alone.
const bracketed = /\(.*?\)/g;
// Hiragana, katakana, the iteration mark, CJK kanji, and half width katakana (AC-6).
const japaneseScript = /[぀-ヿ々一-鿿ｦ-ﾟ]/;

// NFKD (full width becomes plain, accents split off), combining marks dropped, lowercase,
// hyphens and slashes become spaces, anything else that is not a letter, digit, or space removed,
// spaces collapsed and trimmed.
export function normalizeMeaning(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[-/\s]/gu, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/ +/g, " ")
    .trim();
}

function withoutLeadingTo(raw: string): string[] {
  return leadingTo.test(raw) ? [raw, raw.replace(leadingTo, "")] : [raw];
}

function normalizedUnique(raws: string[]): string[] {
  const forms = raws.map(normalizeMeaning).filter((f) => f !== "");
  return [...new Set(forms)];
}

// The up to four forms of an accepted meaning or synonym (AC-1): the full text and the text with
// every bracketed part removed, each also without a leading "to ", normalized and deduplicated.
export function meaningForms(text: string): string[] {
  return normalizedUnique([text, text.replace(bracketed, "")].flatMap(withoutLeadingTo));
}

// What you typed: itself and itself without a leading "to " (AC-1).
export function inputForms(text: string): string[] {
  return normalizedUnique(withoutLeadingTo(text));
}

// Every form of every subject's meanings: the course word guard (AC-3).
export function buildCourseForms(meaningLists: readonly Meaning[][]): Set<string> {
  const forms = new Set<string>();
  for (const list of meaningLists) {
    for (const m of list) for (const f of meaningForms(m.text)) forms.add(f);
  }
  return forms;
}

// Edits allowed for an accepted form of this length (AC-2).
export function tolerance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return Math.floor(length / 4);
}

// On raw text, before any normalization (AC-6).
export function hasJapaneseScript(text: string): boolean {
  return japaneseScript.test(text);
}

// The digits of a normalized form, in order (AC-2).
export function digitsOf(text: string): string {
  return text.replace(/[^\p{N}]/gu, "");
}
