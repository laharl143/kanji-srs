// Pure part of the voice check (spec 0009 AC-10): a voice whose language starts with "ja"
// ("ja-JP", "ja_JP", "ja"), or null. On device voices win over Android's "-network" voices,
// which are silent offline; a network voice is still used when it is the only one.
export function findJapaneseVoice(
  voices: readonly { identifier: string; language: string }[],
): string | null {
  const ja = voices.filter((v) => v.language.toLowerCase().startsWith("ja"));
  const local = ja.find((v) => !v.identifier.toLowerCase().includes("network"));
  return (local ?? ja[0])?.identifier ?? null;
}
