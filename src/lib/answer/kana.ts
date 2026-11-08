// Romaji to hiragana for the reading field (spec 0004 AC-10) and reading normalization
// (spec 0007 AC-4, AC-6). Pure: wanakana only.
import { toHiragana, toKana, toRomaji } from "wanakana";

// While typing. Lowercased first, because wanakana turns capitals into katakana and keyboards
// capitalize the first letter. IME mode leaves a trailing "n" alone until the next letter.
export function toReadingInput(text: string): string {
  return toKana(text.toLowerCase(), { IMEMode: true });
}

// The final value to check: a trailing "n" only becomes ん once the word is finished.
export function finishReadingInput(text: string): string {
  return toKana(text.toLowerCase());
}

const vowelKana: Record<string, string> = { a: "あ", i: "い", u: "う", e: "え", o: "お" };
const hiraganaChar = /^[ぁ-ゖゝゞ]$/u;
const hiraganaOnly = /^[ぁ-ゖゝゞ]+$/u;

// NFKC (half width katakana become full width), katakana to hiragana (romaji is left alone so it
// can be caught as invalid), each hiragana ー after a kana becomes that kana's vowel, and spaces
// are removed (AC-4).
export function normalizeReading(text: string): string {
  const hira = toHiragana(text.normalize("NFKC"), { passRomaji: true }).replace(/\s/gu, "");
  let out = "";
  for (const ch of hira) {
    const prev = out.slice(-1);
    if (ch === "ー" && hiraganaChar.test(prev)) {
      out += vowelKana[toRomaji(prev).slice(-1)] ?? ch;
    } else {
      out += ch;
    }
  }
  return out;
}

// Hiragana only, after normalizeReading. A ー left over (no kana before it) fails (AC-6).
export function isHiraganaOnly(text: string): boolean {
  return hiraganaOnly.test(text);
}
