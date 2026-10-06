/**
 * appFetch, the only way features call the network (§41.2).
 * Browser → same-origin /api/proxy (single door) → FastAPI. Server → API_BASE_URL direct.
 * Unwraps the envelope, parses FastAPI-style errors, exposes machine-readable error.code.
 */
import { APIRequestError, throwApiError, type ErrorShape } from "./error-utils";
import { API_BASE } from "./base";

const isServer = typeof window === "undefined";
export const SERVER_BASE = API_BASE;
const CLIENT_BASE = "/api/proxy";

export type AppFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  params?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  /** ask the proxy to attach the Bearer token from the httpOnly-ish cookie */
  _auth?: boolean;
  /** multipart upload */
  _formData?: FormData;
  signal?: AbortSignal;
  _json?: boolean;
  cache?: RequestCache;
};

function buildUrl(base: string, endpoint: string, params?: Record<string, unknown>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((item) => qs.append(k, String(item)));
    else qs.set(k, String(v));
  }
  const suffix = qs.toString();
  return `${base}${endpoint}${suffix ? `?${suffix}` : ""}`;
}

async function getResponseData(res: Response) {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return res.json();
  if (ct.includes("text/")) return res.text();
  // binary (CV PDF exports, CSV downloads), §12.2 blob sniffing
  return res.blob();
}

export async function appFetch<T = unknown>(endpoint: string, options: AppFetchOptions = {}): Promise<T> {
  const base = isServer ? `${SERVER_BASE}/api/v1` : CLIENT_BASE;
  const url = buildUrl(base, endpoint, options.params);
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  let body: BodyInit | undefined;
  if (options._formData) {
    body = options._formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (options._auth !== false) headers["X-Use-Auth"] = "true";

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
    signal: options.signal ?? AbortSignal.timeout(20_000),
    cache: options.cache,
    credentials: "same-origin",
  });

  const data = await getResponseData(res);
  if (!res.ok) {
    // dead session after the proxy's silent refresh failed → back to login (client GETs only;
    // mutations surface their own toast so a failed POST never navigates away from typed input)
    if (!isServer && res.status === 401 && (options.method ?? "GET") === "GET" && !window.location.pathname.startsWith("/auth")) {
      // deliberate hard navigation: appFetch runs outside React (there is no router here)
      // and a full reload guarantees no stale authorised UI survives a dead session
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/auth/login");
    }
    throwApiError(res.status, data, `${options.method ?? "GET"} ${endpoint} failed`);
  }

  // envelope unwrap: { status, status_code, message, data }
  if (data && typeof data === "object" && "status" in data && "data" in data) return data.data as T;
  return data as T;
}

export { APIRequestError, throwApiError };
export type { ErrorShape };
