import type { NewSubject } from "@/lib/db/schema";

// A small subject row with sensible defaults; override what a test cares about.
export function subject(overrides: Partial<NewSubject> & { id: number }): NewSubject {
  return {
    type: "radical",
    characters: `c${overrides.id}`,
    level: 1,
    position: overrides.id,
    meanings: [{ text: `meaning ${overrides.id}`, primary: true }],
    readings: [],
    componentIds: [],
    meaningMnemonic: `mnemonic ${overrides.id}`,
    readingMnemonic: null,
    jlpt: null,
    frequency: null,
    ...overrides,
  };
}
