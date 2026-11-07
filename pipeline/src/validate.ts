// npm run pipeline:validate
// Every content rule in one place (spec 0005 Validation rules). validate, merge, bundle, and the
// content test in npm test all call these, so they can never disagree.
import type { ContentSubject } from "../../src/lib/content/types";
import { entryOf, fieldText, hookOf, withBatch, type BatchFile, type BatchItem } from "./batch";
import {
  filled,
  firstPrimaryReading,
  loadContent,
  missingMnemonic,
  MNEMONIC_KEY,
  subjectKey,
  type Content,
  type IdEntry,
} from "./content";

export type ContentRuleName =
  | "radical-before-kanji"
  | "kanji-before-vocab"
  | "has-meaning-reading"
  | "enabled-has-mnemonic"
  | "kanji-names-radicals"
  | "radical-name-shape"
  | "unique-radical-names"
  | "hook-format"
  | "sound-hook"
  | "unique-sound-hooks"
  | "unique-ids"
  | "stable-ids"
  | "enabled-levels";

// Rules only merge runs, on one batch (spec 0005 Merge rules).
export type BatchRuleName = "batch-identity" | "batch-filled" | "no-overwrite" | "hook-consistent";

export type RuleName = ContentRuleName | BatchRuleName;
export type WarningName = "shipped-retired" | "orphan-mnemonic";

export type Failure = {
  rule: RuleName;
  // "kanji:休", "reading:せん", or a file name such as "enabled-levels.json".
  subject: string;
  // The subject's level; null for readings and files (printed "-").
  level: number | null;
  message: string;
};

export type Warning = Omit<Failure, "rule"> & { rule: WarningName };

export const formatLine = (f: Failure | Warning) =>
  `[${f.rule}] ${f.subject} (level ${f.level ?? "-"}): ${f.message}`;

const RADICAL_NAME = /^\S+( \S+){0,2}$/;
const HOOK_WORD = /^[a-z]+$/;

// "gets" uses the hook "get" and "forget" does not: the hook must start a word.
export function usesHook(text: string, hook: string): boolean {
  const escaped = hook.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}`, "i").test(text);
}

// Where a failure points: a subject (its key and level), or a reading or file (no level).
type Target = { subject: string; level: number | null };
type Where = ContentSubject | Target;

function failure(rule: RuleName, at: Where, message: string): Failure {
  return "subject" in at
    ? { rule, subject: at.subject, level: at.level, message }
    : { rule, subject: subjectKey(at), level: at.level, message };
}

const keyOf = (e: IdEntry) => subjectKey(e);
const readingAt = (reading: string): Target => ({ subject: `reading:${reading}`, level: null });
const fileAt = (file: string): Target => ({ subject: file, level: null });

// Lookups the rules share, built once per run.
type Index = {
  byId: Map<number, ContentSubject>;
  byKey: Map<string, ContentSubject>;
  // A mnemonics file key as a failure target, with the level of its subject when there is one.
  entryAt: (type: ContentSubject["type"], characters: string) => Target;
};

function index(c: Content): Index {
  const byId = new Map(c.subjects.map((s) => [s.id, s]));
  const byKey = new Map(c.subjects.map((s) => [subjectKey(s), s]));
  return {
    byId,
    byKey,
    entryAt: (type, characters) => {
      const subject = subjectKey({ type, characters });
      return { subject, level: byKey.get(subject)?.level ?? null };
    },
  };
}

function componentsFirst(
  c: Content,
  ix: Index,
  rule: ContentRuleName,
  type: "kanji" | "vocab",
  partType: "radical" | "kanji",
): Failure[] {
  const out: Failure[] = [];
  for (const s of c.subjects) {
    if (s.type !== type) continue;
    for (const id of s.componentIds) {
      const part = ix.byId.get(id);
      if (!part || part.type !== partType) {
        out.push(failure(rule, s, `component id ${id} is not a ${partType}`));
      } else if (part.level > s.level) {
        out.push(
          failure(rule, s, `${partType} ${part.characters} is in a later level (${part.level})`),
        );
      }
    }
  }
  return out;
}

// Groups map keys by a shared value and fails every member of a group with two or more.
function sharedValues(
  rule: ContentRuleName,
  entries: [string, unknown][],
  at: (key: string) => Target,
  what: string,
): Failure[] {
  const groups = new Map<string, string[]>();
  for (const [key, value] of entries) {
    if (!filled(value)) continue;
    const norm = value.trim().toLowerCase();
    groups.set(norm, [...(groups.get(norm) ?? []), key]);
  }
  return [...groups].flatMap(([value, keys]) =>
    keys.length < 2
      ? []
      : keys.map((key) => {
          const others = keys.filter((k) => k !== key).map((k) => at(k).subject);
          return failure(rule, at(key), `${what} "${value}" is also used by ${others.join(", ")}`);
        }),
  );
}

const RULES: Record<ContentRuleName, (c: Content, ix: Index) => Failure[]> = {
  "radical-before-kanji": (c, ix) =>
    componentsFirst(c, ix, "radical-before-kanji", "kanji", "radical"),

  "kanji-before-vocab": (c, ix) => componentsFirst(c, ix, "kanji-before-vocab", "vocab", "kanji"),

  "has-meaning-reading": (c) =>
    c.subjects
      .filter((s) => s.type !== "radical")
      .flatMap((s) => [
        ...(s.meanings.some((m) => filled(m.text))
          ? []
          : [failure("has-meaning-reading", s, "has no meaning")]),
        ...(s.readings.some((r) => filled(r.text))
          ? []
          : [failure("has-meaning-reading", s, "has no reading")]),
      ]),

  "enabled-has-mnemonic": (c) => {
    const enabled = new Set(c.enabledLevels);
    return c.subjects.flatMap((s) => {
      const missing = enabled.has(s.level) ? missingMnemonic(s, c.mnemonics) : [];
      if (missing.length === 0) return [];
      const file = `${MNEMONIC_KEY[s.type]}.json`;
      return [
        failure(
          "enabled-has-mnemonic",
          s,
          `level is enabled, but ${file} has no ${missing.join(" or ")}`,
        ),
      ];
    });
  },

  "kanji-names-radicals": (c, ix) => {
    const out: Failure[] = [];
    for (const s of c.subjects) {
      const story = s.type === "kanji" ? c.mnemonics.kanji[s.characters]?.meaningMnemonic : null;
      if (!filled(story)) continue;
      const lower = story.toLowerCase();
      for (const id of s.componentIds) {
        const radical = ix.byId.get(id);
        if (radical?.type !== "radical") continue; // radical-before-kanji reports it
        const name = c.mnemonics.radicals[radical.characters]?.name;
        if (!filled(name)) {
          out.push(failure("kanji-names-radicals", s, `radical ${radical.characters} has no name`));
        } else if (!lower.includes(name.trim().toLowerCase())) {
          out.push(
            failure(
              "kanji-names-radicals",
              s,
              `meaning mnemonic does not name radical "${name.trim()}" (${radical.characters})`,
            ),
          );
        }
      }
    }
    return out;
  },

  "radical-name-shape": (c, ix) =>
    Object.entries(c.mnemonics.radicals)
      .filter(([, m]) => typeof m?.name !== "string" || !RADICAL_NAME.test(m.name))
      .map(([chars, m]) =>
        failure(
          "radical-name-shape",
          ix.entryAt("radical", chars),
          `name "${m?.name ?? ""}" is not 1 to 3 words separated by single spaces`,
        ),
      ),

  "unique-radical-names": (c, ix) =>
    sharedValues(
      "unique-radical-names",
      Object.entries(c.mnemonics.radicals).map(([chars, m]) => [chars, m?.name]),
      (chars) => ix.entryAt("radical", chars),
      "name",
    ),

  "hook-format": (c) =>
    Object.entries(c.soundHooks)
      .filter(([, hook]) => typeof hook !== "string" || !HOOK_WORD.test(hook))
      .map(([reading, hook]) =>
        failure(
          "hook-format",
          readingAt(reading),
          `hook "${hook}" is not one lowercase English word`,
        ),
      ),

  "sound-hook": (c) => {
    const out: Failure[] = [];
    for (const s of c.subjects) {
      const text = s.type === "kanji" ? c.mnemonics.kanji[s.characters]?.readingMnemonic : null;
      if (!filled(text)) continue;
      const reading = firstPrimaryReading(s);
      const hook = reading === undefined ? undefined : c.soundHooks[reading];
      if (reading === undefined) {
        out.push(failure("sound-hook", s, "has no primary reading to hang a sound hook on"));
      } else if (!filled(hook)) {
        out.push(
          failure(
            "sound-hook",
            s,
            `sound-hooks.json has no hook for its first primary reading ${reading}`,
          ),
        );
      } else if (!usesHook(text, hook)) {
        out.push(
          failure(
            "sound-hook",
            s,
            `reading mnemonic does not use the hook "${hook.trim()}" (for ${reading}) at the start of a word`,
          ),
        );
      }
    }
    return out;
  },

  "unique-sound-hooks": (c) =>
    sharedValues("unique-sound-hooks", Object.entries(c.soundHooks), readingAt, "hook"),

  "unique-ids": (c, ix) => {
    const out: Failure[] = [];
    const ids = new Map<number, ContentSubject>();
    const keys = new Map<string, ContentSubject>();
    for (const s of c.subjects) {
      const sameId = ids.get(s.id);
      const sameKey = keys.get(subjectKey(s));
      if (sameId)
        out.push(failure("unique-ids", s, `id ${s.id} is also used by ${subjectKey(sameId)}`));
      else ids.set(s.id, s);
      if (sameKey)
        out.push(
          failure("unique-ids", s, `is in subjects.json twice (ids ${sameKey.id} and ${s.id})`),
        );
      else keys.set(subjectKey(s), s);
    }
    const retiredIds = new Set<number>();
    for (const e of c.retired) {
      if (retiredIds.has(e.id)) {
        out.push(
          failure(
            "unique-ids",
            { subject: keyOf(e), level: null },
            `retired.json repeats id ${e.id}`,
          ),
        );
      }
      retiredIds.add(e.id);
      const live = ix.byKey.get(keyOf(e));
      if (live) out.push(failure("unique-ids", live, "is in both subjects.json and retired.json"));
    }
    return out;
  },

  "stable-ids": (c, ix) => {
    const out: Failure[] = [];
    const shippedById = new Map(c.shipped.map((e) => [e.id, e]));
    const retiredById = new Map(c.retired.map((e) => [e.id, e]));
    const retiredByKey = new Map(c.retired.map((e) => [keyOf(e), e]));
    for (const e of c.shipped) {
      const live = ix.byKey.get(keyOf(e));
      const retired = retiredByKey.get(keyOf(e));
      const gone = { subject: keyOf(e), level: null };
      if (live) {
        if (live.id !== e.id) {
          out.push(
            failure(
              "stable-ids",
              live,
              `shipped with id ${e.id}, but subjects.json gives it id ${live.id}`,
            ),
          );
        }
      } else if (!retired) {
        out.push(
          failure(
            "stable-ids",
            gone,
            `shipped with id ${e.id}, but is in neither subjects.json nor retired.json`,
          ),
        );
      } else if (retired.id !== e.id) {
        out.push(
          failure(
            "stable-ids",
            gone,
            `shipped with id ${e.id}, but retired.json gives it id ${retired.id}`,
          ),
        );
      }
    }
    for (const s of c.subjects) {
      const shipped = shippedById.get(s.id);
      if (shipped && keyOf(shipped) !== subjectKey(s)) {
        out.push(failure("stable-ids", s, `id ${s.id} already shipped as ${keyOf(shipped)}`));
      }
      const retired = retiredById.get(s.id);
      if (retired && keyOf(retired) !== subjectKey(s)) {
        out.push(
          failure("stable-ids", s, `id ${s.id} belongs to ${keyOf(retired)} in retired.json`),
        );
      }
    }
    return out;
  },

  "enabled-levels": (c) => {
    const at = fileAt("enabled-levels.json");
    const levels: unknown = c.enabledLevels;
    if (!Array.isArray(levels) || !levels.every((l) => Number.isInteger(l))) {
      return [failure("enabled-levels", at, "must be an array of level numbers")];
    }
    const out: Failure[] = [];
    if (!levels.every((l, i) => l === i + 1)) {
      out.push(
        failure(
          "enabled-levels",
          at,
          `must be 1 to N in order with no gaps, found [${levels.join(", ")}]`,
        ),
      );
    }
    const withSubjects = new Set(c.subjects.map((s) => s.level));
    for (const l of levels) {
      if (!withSubjects.has(l))
        out.push(failure("enabled-levels", at, `level ${l} has no subjects`));
    }
    return out;
  },
};

export const CONTENT_RULES = Object.keys(RULES) as ContentRuleName[];

function warnings(c: Content, ix: Index): Warning[] {
  const out: Warning[] = [];
  const retired = new Set(c.retired.map(keyOf));
  for (const e of c.shipped) {
    if (!ix.byKey.has(keyOf(e)) && retired.has(keyOf(e))) {
      out.push({
        rule: "shipped-retired",
        subject: keyOf(e),
        level: null,
        message: "shipped, now retired: still on the phone with its old text",
      });
    }
  }
  for (const type of ["radical", "kanji", "vocab"] as const) {
    const file = MNEMONIC_KEY[type];
    for (const characters of Object.keys(c.mnemonics[file])) {
      if (!ix.byKey.has(subjectKey({ type, characters }))) {
        out.push({
          rule: "orphan-mnemonic",
          subject: subjectKey({ type, characters }),
          level: null,
          message: `${file}.json has a mnemonic for it, but no subject matches`,
        });
      }
    }
  }
  return out;
}

/** Runs every content rule over the whole course. Failures block; warnings only inform. */
export function validateAll(content: Content): { failures: Failure[]; warnings: Warning[] } {
  const ix = index(content);
  return {
    failures: CONTENT_RULES.flatMap((name) => RULES[name](content, ix)),
    warnings: warnings(content, ix),
  };
}

/** Runs only the named content rules, in the order given. */
export function runRules(content: Content, names: ContentRuleName[]): Failure[] {
  const ix = index(content);
  return names.flatMap((name) => RULES[name](content, ix));
}

// The content rules a batch can break, in the order merge runs them.
const BATCH_CONTENT_RULES: ContentRuleName[] = [
  "radical-name-shape",
  "unique-radical-names",
  "kanji-names-radicals",
  "hook-format",
  "sound-hook",
  "unique-sound-hooks",
];

const itemAt = (item: BatchItem): Target => ({
  subject: subjectKey(item),
  level: typeof item.level === "number" ? item.level : null,
});

// The writable fields per item type, which merge copies into the mnemonics file.
const WRITTEN = {
  radical: ["name", "meaningMnemonic"],
  kanji: ["meaningMnemonic", "readingMnemonic"],
  vocab: ["meaningMnemonic", "readingMnemonic"],
} as const;

const BATCH_RULES: Record<BatchRuleName, (items: BatchItem[], c: Content) => Failure[]> = {
  // A batch planned before a rebuild no longer matches subjects.json.
  "batch-identity": (items, c) => {
    const byId = new Map(c.subjects.map((s) => [s.id, s]));
    return items.flatMap((item) => {
      const s = byId.get(item.id);
      if (!s || s.type !== item.type || s.characters !== item.characters) {
        const now = s
          ? `id ${item.id} is now ${subjectKey(s)}`
          : `id ${item.id} is not in subjects.json`;
        return [
          failure("batch-identity", itemAt(item), `${now}: plan a fresh batch with pipeline:batch`),
        ];
      }
      const reading = item.type === "kanji" ? fieldText(item.soundHook?.reading) : null;
      if (reading !== null && reading !== firstPrimaryReading(s)) {
        return [
          failure(
            "batch-identity",
            s,
            `soundHook.reading ${reading} is not its first primary reading ${firstPrimaryReading(s)}`,
          ),
        ];
      }
      return [];
    });
  },

  "batch-filled": (items) =>
    items.flatMap((item) => {
      const fields: [string, unknown][] =
        item.type === "radical"
          ? [
              ["name", item.name],
              ["meaningMnemonic", item.meaningMnemonic],
            ]
          : item.type === "kanji"
            ? [
                ["meaningMnemonic", item.meaningMnemonic],
                ["readingMnemonic", item.readingMnemonic],
                ["soundHook.hook", item.soundHook?.hook],
              ]
            : [["readingMnemonic", item.readingMnemonic]];
      const empty = fields.filter(([, value]) => !filled(value)).map(([field]) => field);
      return empty.length
        ? [failure("batch-filled", itemAt(item), `still empty: ${empty.join(", ")}`)]
        : [];
    }),

  // The same text is fine, so a rerun after a crash is safe.
  "no-overwrite": (items, c) =>
    items.flatMap((item) => {
      const file = MNEMONIC_KEY[item.type];
      const existing = c.mnemonics[file]?.[item.characters] as Record<string, unknown> | undefined;
      if (!existing) return [];
      const entry = entryOf(item) as Record<string, unknown>;
      const changed = WRITTEN[item.type].filter(
        (f) => fieldText(existing[f]) !== fieldText(entry[f]),
      );
      return changed.length
        ? [
            failure(
              "no-overwrite",
              itemAt(item),
              `${file}.json already has a different ${changed.join(" and ")}: a batch never overwrites written text`,
            ),
          ]
        : [];
    }),

  "hook-consistent": (items, c) => {
    const out: Failure[] = [];
    const given = new Map<string, { hook: string; by: string }>();
    for (const item of items) {
      if (item.type !== "kanji") continue;
      const reading = fieldText(item.soundHook?.reading);
      const hook = hookOf(item);
      if (!reading || !hook) continue;
      const stored = c.soundHooks[reading];
      const earlier = given.get(reading);
      if (filled(stored) && stored.trim() !== hook) {
        out.push(
          failure(
            "hook-consistent",
            itemAt(item),
            `reading ${reading} already has the hook "${stored.trim()}" in sound-hooks.json: keep it`,
          ),
        );
      } else if (earlier && earlier.hook !== hook) {
        out.push(
          failure(
            "hook-consistent",
            itemAt(item),
            `gives reading ${reading} the hook "${hook}", but ${earlier.by} in this batch gives it "${earlier.hook}"`,
          ),
        );
      } else if (!earlier) {
        given.set(reading, { hook, by: subjectKey(item) });
      }
    }
    return out;
  },
};

/**
 * Merge's check for one batch (spec 0005 Merge rules): the batch rules, then the content rules a
 * batch can break, run on the content as it would be with the batch merged. Keeps only failures
 * that involve an item of this batch, so an older problem elsewhere never blocks a merge.
 */
export function validateBatch(batch: BatchFile, content: Content): Failure[] {
  const items = batch.items;
  const failures = (Object.keys(BATCH_RULES) as BatchRuleName[]).flatMap((name) =>
    BATCH_RULES[name](items, content),
  );
  const involved = new Set(items.map((item) => subjectKey(item)));
  for (const item of items) {
    const reading = item.type === "kanji" ? fieldText(item.soundHook?.reading) : "";
    if (reading) involved.add(readingAt(reading).subject);
  }
  const candidate = withBatch(content, batch);
  return [
    ...failures,
    ...runRules(candidate, BATCH_CONTENT_RULES).filter((f) => involved.has(f.subject)),
  ];
}

export type LevelCoverage = { level: number; written: number; total: number; enabled: boolean };

export function coverage(content: Content): LevelCoverage[] {
  const enabled = new Set(content.enabledLevels);
  const levels = [...new Set(content.subjects.map((s) => s.level))].sort((a, b) => a - b);
  return levels.map((level) => {
    const inLevel = content.subjects.filter((s) => s.level === level);
    const written = inLevel.filter((s) => missingMnemonic(s, content.mnemonics).length === 0);
    return { level, written: written.length, total: inLevel.length, enabled: enabled.has(level) };
  });
}

function main() {
  const content = loadContent();
  const { failures, warnings: notes } = validateAll(content);
  for (const line of [...failures, ...notes].map(formatLine)) console.log(line);
  if (failures.length + notes.length > 0) console.log("");
  for (const c of coverage(content)) {
    const count = `${c.written}/${c.total}`.padStart(7);
    console.log(
      `level ${String(c.level).padStart(2)}: ${count} written${c.enabled ? " (enabled)" : ""}`,
    );
  }
  console.log(`\n${failures.length} failure(s), ${notes.length} warning(s)`);
  if (failures.length > 0) process.exit(1);
}

if (process.argv[1]?.endsWith("validate.ts")) main();
