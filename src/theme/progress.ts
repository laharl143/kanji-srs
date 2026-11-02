// Fill fraction for ProgressBar (spec 0003): 0 when max <= 0, value clamped to 0 to max.
export function progressFraction(value: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.min(Math.max(value, 0), max) / max;
}
