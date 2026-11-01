export type SubjectType = "radical" | "kanji" | "vocab";
export type Meaning = { text: string; primary: boolean };
export type Reading = { text: string; primary: boolean; kind?: "onyomi" | "kunyomi" };
