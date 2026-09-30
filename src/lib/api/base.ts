/**
 * Single source of truth for where server-side code talks to the API.
 *
 * The browser only ever hits same-origin `/api/proxy`, this module is for the proxy
 * and other server code. In production it MUST default to the deployed backend:
 * falling back to localhost is exactly how a Vercel build ends up talking to itself.
 * Override any time with API_BASE_URL.
 */
const LIVE_API = "https://backend-v0-3aeu-omega.vercel.app";

export const API_BASE: string =
  process.env.API_BASE_URL || (process.env.NODE_ENV === "production" ? LIVE_API : "http://localhost:8000");
