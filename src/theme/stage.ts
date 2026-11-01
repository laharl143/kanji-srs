// The only place that maps an SRS stage to a group, label, or color class (spec 0003).
export type StageGroup = "locked" | "lesson" | "seed" | "sprout" | "bloom" | "harvest" | "retired";

const labels: Record<StageGroup, string> = {
  locked: "Locked",
  lesson: "Lesson",
  seed: "Seed",
  sprout: "Sprout",
  bloom: "Bloom",
  harvest: "Harvest",
  retired: "Retired",
};

// `null` means no assignment row (locked). Any number outside 0 to 9 is a bug, so it throws.
export function stageGroup(srsStage: number | null): { group: StageGroup; label: string } {
  const group = groupOf(srsStage);
  return { group, label: labels[group] };
}

function groupOf(srsStage: number | null): StageGroup {
  if (srsStage === null) return "locked";
  if (!Number.isInteger(srsStage) || srsStage < 0 || srsStage > 9) {
    throw new Error(`Invalid SRS stage: ${srsStage}`);
  }
  if (srsStage === 0) return "lesson";
  if (srsStage <= 4) return "seed";
  if (srsStage <= 6) return "sprout";
  if (srsStage === 7) return "bloom";
  if (srsStage === 8) return "harvest";
  return "retired";
}

// Full literal class names, because NativeWind cannot read class names built at runtime.
export const stageClasses: Record<StageGroup, { bg: string }> = {
  locked: { bg: "bg-stage-locked" },
  lesson: { bg: "bg-stage-lesson" },
  seed: { bg: "bg-stage-seed" },
  sprout: { bg: "bg-stage-sprout" },
  bloom: { bg: "bg-stage-bloom" },
  harvest: { bg: "bg-stage-harvest" },
  retired: { bg: "bg-stage-retired" },
};
