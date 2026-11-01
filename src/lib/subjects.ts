import type { Meaning } from "@/lib/types";

// The meaning to show for a subject: the first one marked primary, else the first one.
export function primaryMeaning(meanings: Meaning[]): string {
  return (meanings.find((m) => m.primary) ?? meanings[0])?.text ?? "";
}
