// Pure helpers for editing synonyms inside a session (spec 0011).

/**
 * Replaces one subject's synonyms with the list a save returned (spec 0011 AC-4). Every other
 * subject keeps its object, and an unknown id returns the same map, so nothing else rerenders.
 */
export function withSynonyms<T extends { synonyms: string[] }>(
  byId: ReadonlyMap<number, T>,
  subjectId: number,
  synonyms: string[],
): ReadonlyMap<number, T> {
  const subject = byId.get(subjectId);
  if (!subject) return byId;
  const next = new Map(byId);
  next.set(subjectId, { ...subject, synonyms });
  return next;
}

// The synonym sheet's title (spec 0011 AC-1): the item's characters, or "this radical" without.
export function synonymSheetTitle(characters: string | null | undefined): string {
  const shown = characters?.trim();
  return shown ? `Your synonyms for ${shown}` : "Your synonyms for this radical";
}
