// Romaji to hiragana for the reading field (spec 0004 AC-10). Pure: wanakana only.
import { toKana } from "wanakana";

// While typing. Lowercased first, because wanakana turns capitals into katakana and keyboards
// capitalize the first letter. IME mode leaves a trailing "n" alone until the next letter.
export function toReadingInput(text: string): string {
  return toKana(text.toLowerCase(), { IMEMode: true });
}

// The final value to check: a trailing "n" only becomes ん once the word is finished.
export function finishReadingInput(text: string): string {
  return toKana(text.toLowerCase());
}
