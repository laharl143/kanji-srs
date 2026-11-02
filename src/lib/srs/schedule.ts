// SRS math (0001 §6.1, §6.3; spec 0004 Feature design). Pure: `now` is always passed in.
import type { AssignmentPatch } from "@/lib/db/queries/assignments";
import type { Assignment, NewReview } from "@/lib/db/schema";

import { BURNED_STAGE, FIRST_REVIEW_STAGE, HOUR_MS, INTERVAL_MS, PASSED_STAGE } from "./config";

// now + the stage's interval, rounded down to the epoch hour; null at stage 9 (no more reviews).
export function nextAvailableAt(stage: number, now: Date): Date | null {
  const interval = INTERVAL_MS[stage];
  if (interval === undefined) {
    if (stage === BURNED_STAGE) return null;
    throw new Error(`No interval for SRS stage ${stage}`);
  }
  return new Date(Math.floor((now.getTime() + interval) / HOUR_MS) * HOUR_MS);
}

// Lesson quiz done: stage 0 -> 1, first review 4 hours later (spec 0004 AC-7).
export function completeLesson(_a: Assignment, now: Date): AssignmentPatch {
  return {
    srsStage: FIRST_REVIEW_STAGE,
    startedAt: now.getTime(),
    availableAt: nextAvailableAt(FIRST_REVIEW_STAGE, now)!.getTime(),
  };
}

export function newStage(stage: number, wrongMeaning: number, wrongReading: number): number {
  const wrong = wrongMeaning + wrongReading;
  if (wrong === 0) return Math.min(BURNED_STAGE, stage + 1);
  const penalty = stage >= PASSED_STAGE ? 2 : 1;
  return Math.max(FIRST_REVIEW_STAGE, stage - Math.ceil(wrong / 2) * penalty);
}

// A completed review: the assignment update and the reviews row to write with it.
export function applyReview(
  a: Assignment,
  wrongMeaning: number,
  wrongReading: number,
  now: Date,
): { patch: AssignmentPatch; review: Omit<NewReview, "id" | "userId"> } {
  const stage = newStage(a.srsStage, wrongMeaning, wrongReading);
  const at = now.getTime();
  const patch: AssignmentPatch = {
    srsStage: stage,
    availableAt: nextAvailableAt(stage, now)?.getTime() ?? null,
  };
  if (stage >= PASSED_STAGE && a.passedAt === null) patch.passedAt = at;
  if (stage === BURNED_STAGE) patch.burnedAt = at;
  return {
    patch,
    review: {
      subjectId: a.subjectId,
      createdAt: at,
      startingStage: a.srsStage,
      endingStage: stage,
      incorrectMeaningCount: wrongMeaning,
      incorrectReadingCount: wrongReading,
    },
  };
}
