// The end of session summary (spec 0006 AC-9), worked out from the saved review results. Pure.
import { STAGES } from "@/lib/srs/config";

import type { CompletedItem } from "./queue";
import type { ReviewResult } from "./reviews";

export type SavedReview = { item: CompletedItem; result: ReviewResult };
export type StageChange = { from: string; to: string; direction: "up" | "down" | "same" };
export type SummaryEntry = { subjectId: number; change: StageChange };
export type SessionSummary = {
  saved: number;
  // Each in the order the items finished. Correct means no wrong answer at all.
  correct: SummaryEntry[];
  incorrect: SummaryEntry[];
  // The highest level a review in this session opened, or null.
  levelUp: number | null;
  // How many subjects this session's reviews unlocked.
  newLessons: number;
};

const names = new Map(STAGES.map((s) => [s.stage, s.name]));

// "Seed 4", "Sprout 1", ... from the stage table in `@/lib/srs/config`.
export function stageName(stage: number): string {
  const name = names.get(stage);
  if (name === undefined) throw new Error(`Invalid SRS stage: ${stage}`);
  return name;
}

export function stageChange(from: number, to: number): StageChange {
  return {
    from: stageName(from),
    to: stageName(to),
    direction: to > from ? "up" : to < from ? "down" : "same",
  };
}

// What TalkBack says about a stage change; it carries the up or down mark in words.
export function describeChange(change: StageChange): string {
  if (change.direction === "same") return `Stayed at ${change.from}`;
  return `Moved ${change.direction} from ${change.from} to ${change.to}`;
}

export function summarizeReviews(saved: readonly SavedReview[]): SessionSummary {
  const correct: SummaryEntry[] = [];
  const incorrect: SummaryEntry[] = [];
  let levelUp: number | null = null;
  let newLessons = 0;
  for (const { item, result } of saved) {
    const entry = {
      subjectId: item.subjectId,
      change: stageChange(result.startingStage, result.newStage),
    };
    (item.wrongMeaning + item.wrongReading === 0 ? correct : incorrect).push(entry);
    if (result.newLevel !== null) levelUp = Math.max(levelUp ?? result.newLevel, result.newLevel);
    newLessons += result.unlocked;
  }
  return { saved: saved.length, correct, incorrect, levelUp, newLessons };
}
