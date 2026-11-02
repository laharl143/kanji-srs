// Katakana to hiragana (U+30A1..U+30F6 shift down by 0x60). Everything else passes through.
export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// CJK unified ideographs (main block and extension A). The iteration mark 々 is not a kanji.
export function isKanji(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

export function kanjiIn(text: string): string[] {
  return [...text].filter(isKanji);
}
