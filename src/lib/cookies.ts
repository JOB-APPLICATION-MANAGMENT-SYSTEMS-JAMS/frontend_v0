/**
 * The one place the session cookie names exist (§38.1). The route guard, the proxy
 * and the session routes all import this, so a rename can never leave a stale
 * string behind that would silently keep a dead session alive.
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: "jams_access",
  REFRESH_TOKEN: "jams_refresh",
  USER_ROLE: "jams_role",
} as const;
