// Route params for `/subjects/[id]` and `/levels/[n]` (spec 0009 AC-11): a positive whole number
// with no sign, no decimals, and no leading zero, up to nine digits. Anything else is rejected.
const POSITIVE_ID = /^[1-9]\d{0,8}$/;

export function parsePositiveParam(value: string | string[] | undefined): number | null {
  if (typeof value !== "string" || !POSITIVE_ID.test(value)) return null;
  return Number(value);
}
