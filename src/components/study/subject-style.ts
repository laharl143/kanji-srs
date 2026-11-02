import type { SubjectType } from "@/lib/types";

// Full literal class names, because NativeWind cannot read class names built at runtime.
export const subjectBg: Record<SubjectType, string> = {
  radical: "bg-radical",
  kanji: "bg-kanji",
  vocab: "bg-vocab",
};

export const subjectText: Record<SubjectType, string> = {
  radical: "text-radical",
  kanji: "text-kanji",
  vocab: "text-vocab",
};

export const subjectLabel: Record<SubjectType, string> = {
  radical: "Radical",
  kanji: "Kanji",
  vocab: "Vocabulary",
};
