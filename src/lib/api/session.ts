/**
 * Browser session helpers (§38.1): tokens from a login/signup response go straight into
 * the cookie jar via POST /api/session — app JS never keeps them. One implementation for
 * every page so the cookie contract (names, role flag, method) cannot drift between
 * login, signup, the rail's sign-out and Settings.
 */

export type SessionTokens = {
  access_token?: string;
  refresh_token?: string;
  role?: string;
};

/** What POST /auth/login and /auth/register return (§4.1). */
export type AuthSessionResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  /** local mode only: lets the client verify the fresh account without an inbox */
  verification_token?: string;
  requires_verification?: boolean;
  user?: { id: string; email: string; verified: boolean };
};

export async function setSession(tokens: SessionTokens): Promise<void> {
  await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...tokens, role: tokens.role ?? "owner" }),
  });
}

export async function clearSession(): Promise<void> {
  await fetch("/api/session", { method: "DELETE" });
}
