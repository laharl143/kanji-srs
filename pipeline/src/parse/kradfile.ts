// KRADFILE as jmdict-simplified JSON: kanji -> its visual components, in file order.
export type KradfileJson = { kanji: Record<string, string[]> };

export function parseKradfile(json: KradfileJson): Map<string, string[]> {
  return new Map(Object.entries(json.kanji).map(([k, parts]) => [k, [...new Set(parts)]]));
}
