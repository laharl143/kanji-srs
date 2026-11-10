import { acceptedAnswers } from "@/lib/answer/check";
import type { ItemDetails } from "@/lib/study/lessons";
import type { Meaning, Reading, SubjectType } from "@/lib/types";

// One block "Show details" reveals: a mnemonic and your note, with the note's label.
export type DetailPart = { mnemonic: string | null; note: string | null; noteLabel: string };

// What "Show details" reveals after a wrong answer (spec 0009 AC-7): the mnemonic and your note
// for the question's kind. null hides the toggle, when that kind has neither.
export function detailsFor(
  kind: "meaning" | "reading",
  details: ItemDetails,
): { mnemonic: string | null; note: string | null } | null {
  const mnemonic = (kind === "meaning" ? details.meaningMnemonic : details.readingMnemonic) || null;
  const note = (kind === "meaning" ? details.meaningNote : details.readingNote) || null;
  return mnemonic || note ? { mnemonic, note } : null;
}

// The Not quite card's Show details for one typed question: its kind's part, or none.
export function detailParts(kind: "meaning" | "reading", details: ItemDetails): DetailPart[] {
  const shown = detailsFor(kind, details);
  if (!shown) return [];
  return [{ ...shown, noteLabel: kind === "meaning" ? "Your meaning note" : "Your reading note" }];
}

// What an Anki card's "Show details" reveals (spec 0012 AC-4): the meaning mnemonic and note,
// then the reading mnemonic and note (left out for radicals). Parts with neither are dropped;
// an empty list hides the toggle.
export function cardDetails(type: SubjectType, details: ItemDetails): DetailPart[] {
  const kinds: ("meaning" | "reading")[] =
    type === "radical" ? ["meaning"] : ["meaning", "reading"];
  return kinds.flatMap((kind) => detailParts(kind, details));
}

// The meanings an Anki card reveals (spec 0012 AC-4): primary ones first, then the others, then
// your synonyms.
export function cardMeanings(
  subject: { type: SubjectType; meanings: Meaning[]; readings: Reading[] },
  synonyms: readonly string[],
): string[] {
  const meanings = [
    ...subject.meanings.filter((m) => m.primary),
    ...subject.meanings.filter((m) => !m.primary),
  ];
  return acceptedAnswers("meaning", { ...subject, meanings }, synonyms);
}
