// The app has one local user. Every progress row stores this id so sync can be added later.
export const LOCAL_USER_ID = "local";

// The only place app code gets a user id (spec 0002 AC-4).
export function getCurrentUserId(): string {
  return LOCAL_USER_ID;
}
