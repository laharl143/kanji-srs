// SRS stages and intervals (0001 §6.1). Pure: no DB, framework, or clock.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const LESSON_STAGE = 0;
export const FIRST_REVIEW_STAGE = 1;
// "Passed" means stage 5 or higher.
export const PASSED_STAGE = 5;
export const BURNED_STAGE = 9;

export const STAGES: { stage: number; name: string }[] = [
  { stage: 0, name: "Lesson" },
  { stage: 1, name: "Seed 1" },
  { stage: 2, name: "Seed 2" },
  { stage: 3, name: "Seed 3" },
  { stage: 4, name: "Seed 4" },
  { stage: 5, name: "Sprout 1" },
  { stage: 6, name: "Sprout 2" },
  { stage: 7, name: "Bloom" },
  { stage: 8, name: "Harvest" },
  { stage: 9, name: "Retired" },
];

// Time until the next review after reaching each stage 1 to 8. Stage 9 has none.
export const INTERVAL_MS: Record<number, number> = {
  1: 4 * HOUR,
  2: 8 * HOUR,
  3: DAY,
  4: 2 * DAY,
  5: 7 * DAY,
  6: 14 * DAY,
  7: 30 * DAY,
  8: 120 * DAY,
};

export const HOUR_MS = HOUR;
