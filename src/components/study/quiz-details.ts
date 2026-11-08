import type { ItemDetails } from "@/lib/study/lessons";

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
