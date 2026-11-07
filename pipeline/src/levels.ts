// 0001 §5.3 level building: order, pack, place radicals and vocab, assign stable ids.
import type { ContentSubject } from "../../src/lib/content/types";
import type { SubjectType } from "../../src/lib/types";
import { idEntry, subjectKey, type IdEntry } from "./content";
import type { SelectedKanji, Selection } from "./select";

export const KANJI_PER_LEVEL = 25;

const TYPE_ORDER: Record<SubjectType, number> = { radical: 0, kanji: 1, vocab: 2 };

const key = (type: SubjectType, characters: string) => subjectKey({ type, characters });

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

export type Levels = { subjects: ContentSubject[]; retired: IdEntry[] };

/**
 * Builds every level. `previous` is the last content/subjects.json and `retired` the last
 * content/retired.json: an item matched by type and characters in either keeps its id (a retired
 * item that comes back leaves the list), a previous item the selection lacks joins the list, and
 * new items get ids above every id in both, so an id is never renumbered or reused (0001 §5.3
 * step 6, spec 0005 AC-9).
 */
export function buildLevels(
  selection: Selection,
  previous: ContentSubject[],
  retired: IdEntry[] = [],
): Levels {
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

  // Known ids: the previous subjects.json first, then retired.json.
  const known = [...previous.map(idEntry), ...retired.map(idEntry)];
  const ids = new Map<string, number>();
  for (const e of known) if (!ids.has(subjectKey(e))) ids.set(subjectKey(e), e.id);
  let nextId = known.reduce((max, e) => Math.max(max, e.id), 0) + 1;
  for (const d of drafts) {
    const k = key(d.type, d.characters);
    if (!ids.has(k)) ids.set(k, nextId++);
  }

  const componentType = (t: SubjectType): SubjectType => (t === "kanji" ? "radical" : "kanji");
  const subjects = drafts.map(({ components, ...d }) => ({
    id: ids.get(key(d.type, d.characters))!,
    ...d,
    componentIds: components.map((c) => ids.get(key(componentType(d.type), c))!),
  }));

  // Everything known that is not in the course now stays retired, so its id stays taken.
  const live = new Set(subjects.map(subjectKey));
  const seen = new Set<string>();
  const stillRetired = known.filter((e) => {
    const k = subjectKey(e);
    if (live.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { subjects, retired: stillRetired.sort((a, b) => a.id - b.id) };
}

/** What a build changed in retired.json: items it retired, and retired items it brought back. */
export function retiredChanges(before: IdEntry[], after: IdEntry[]) {
  const was = new Set(before.map(subjectKey));
  const now = new Set(after.map(subjectKey));
  return {
    retired: after.filter((e) => !was.has(subjectKey(e))),
    restored: before.filter((e) => !now.has(subjectKey(e))),
  };
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
