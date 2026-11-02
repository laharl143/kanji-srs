import type { Subject } from "@/lib/db/schema";

// One subject in content/bundle.json: every subjects column, nullable ones present as null, so
// it fits NewSubject as is (spec 0004 Content rules).
export type BundleSubject = Subject;

export type Bundle = { subjects: BundleSubject[] };

// What the app ships: the bundle plus its version (the trimmed text of content-version.txt).
export type BundledContent = { bundle: Bundle; version: string };

// A subject in content/subjects.json, before mnemonics are merged in. Radicals have no meanings
// yet; their name comes from the mnemonics files.
export type ContentSubject = Omit<BundleSubject, "meaningMnemonic" | "readingMnemonic">;
