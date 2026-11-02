// Services return their errors instead of throwing, so screens handle them without try and catch
// (spec 0004 Rationale). A thrown error still means a DB failure.
export type ServiceError = "not_due" | "not_found" | "not_pending";

export type ServiceResult<T extends { ok: true }, E extends ServiceError> =
  T | { ok: false; error: E };
