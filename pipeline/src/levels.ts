// 0001 §5.3 level building: order, pack, place radicals and vocab, assign stable ids.
import type { ContentSubject } from "../../src/lib/content/types";
import type { SubjectType } from "../../src/lib/types";
import type { SelectedKanji, Selection } from "./select";

export const KANJI_PER_LEVEL = 25;

const TYPE_ORDER: Record<SubjectType, number> = { radical: 0, kanji: 1, vocab: 2 };

const key = (type: SubjectType, characters: string) => `${type}:${characters}`;

// N5 first, then N4, then N3; within a level most frequent first, missing frequency last.
export function orderKanji(kanji: SelectedKanji[]): SelectedKanji[] {
  return [...kanji].sort(
    (a, b) =>
      b.jlpt - a.jlpt ||
      (a.frequency ?? Infinity) - (b.frequency ?? Infinity) ||
      (a.literal.codePointAt(0) ?? 0) - (b.literal.codePointAt(0) ?? 0),
  );
}

type Draft = Omit<ContentSubject, "id" | "componentIds"> & { components: string[] };

/**
 * Builds every level. `previous` is the last content/subjects.json: an item matched by type and
 * characters keeps its id, and new items get ids above the highest one used so far, so an id is
 * never renumbered or reused (0001 §5.3 step 6).
 */
export function buildLevels(selection: Selection, previous: ContentSubject[]): ContentSubject[] {
  const ordered = orderKanji(selection.kanji);
  const kanjiLevel = new Map<string, number>();
  const kanjiIndex = new Map<string, number>();
  ordered.forEach((k, i) => {
    kanjiLevel.set(k.literal, Math.floor(i / KANJI_PER_LEVEL) + 1);
    kanjiIndex.set(k.literal, i);
  });

  const drafts: Draft[] = [];

  // Radicals: in the level of the first kanji that uses them, in order of first use.
  const radicalSeen = new Set<string>();
  for (const k of ordered) {
    for (const part of k.components) {
      if (radicalSeen.has(part)) continue;
      radicalSeen.add(part);
      drafts.push(draft("radical", part, kanjiLevel.get(k.literal)!, [], [], null, null, []));
    }
  }

  for (const k of ordered) {
    drafts.push(
      draft(
        "kanji",
        k.literal,
        kanjiLevel.get(k.literal)!,
        k.meanings,
        k.readings,
        k.jlpt,
        k.frequency,
        k.components,
      ),
    );
  }

  // Vocab: in the level of its latest kanji; within a level by when that kanji arrives, then
  // easier JLPT first, then list order.
  const vocab = selection.vocab.map((v, i) => {
    const last = Math.max(...v.kanji.map((c) => kanjiIndex.get(c)!));
    return { v, i, last, level: kanjiLevel.get(ordered[last].literal)! };
  });
  vocab.sort((a, b) => a.last - b.last || b.v.jlpt - a.v.jlpt || a.i - b.i);
  for (const { v, level } of vocab) {
    drafts.push(draft("vocab", v.characters, level, v.meanings, v.readings, v.jlpt, null, v.kanji));
  }

  // Position counts from 1 within each level and type.
  drafts.sort((a, b) => a.level - b.level || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
  const counters = new Map<string, number>();
  for (const d of drafts) {
    const c = `${d.level}:${d.type}`;
    const next = (counters.get(c) ?? 0) + 1;
    counters.set(c, next);
    d.position = next;
  }

  const ids = new Map(previous.map((s) => [key(s.type, s.characters), s.id]));
  let nextId = previous.reduce((max, s) => Math.max(max, s.id), 0) + 1;
  for (const d of drafts) {
    const k = key(d.type, d.characters);
    if (!ids.has(k)) ids.set(k, nextId++);
  }

  const componentType = (t: SubjectType): SubjectType => (t === "kanji" ? "radical" : "kanji");
  return drafts.map(({ components, ...d }) => ({
    id: ids.get(key(d.type, d.characters))!,
    ...d,
    componentIds: components.map((c) => ids.get(key(componentType(d.type), c))!),
  }));
}

function draft(
  type: SubjectType,
  characters: string,
  level: number,
  meanings: Draft["meanings"],
  readings: Draft["readings"],
  jlpt: number | null,
  frequency: number | null,
  components: string[],
): Draft {
  return { type, characters, level, position: 0, meanings, readings, jlpt, frequency, components };
}
