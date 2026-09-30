/**
 * The single door (§41.1), copy of the reference's /api/proxy/[...path] pattern:
 * strip prefix → re-root on API_BASE_URL/api/v1 → attach Bearer from cookie when the
 * client sets X-Use-Auth → stream the response back untouched (blobs, SSE, downloads).
 * Improvements over the reference: X-Request-Id injection + structured log line.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { API_BASE } from "@/lib/api/base";
const MAX_REDIRECTS = 10;

export const runtime = "nodejs";

const isProd = process.env.NODE_ENV === "production";

/**
 * Silent refresh (§38.1): access tokens live 15 min, refresh tokens 30 days.
 * On TOKEN_EXPIRED the proxy trades the refresh cookie for a new pair, sets the
 * cookies and retries once, app JS still never touches a token.
 */
async function refreshSession(request: NextRequest): Promise<{ access: string; refresh?: string } | null> {
  const refreshToken = request.cookies.get("jams_refresh")?.value;
  if (!refreshToken) return null;
  try {
    const r = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    const json = await r.json();
    const access = json?.data?.access_token;
    if (!access) return null;
    return { access, refresh: json?.data?.refresh_token };
  } catch {
    return null;
  }
}

function sessionCookies(res: NextResponse, tokens: { access: string; refresh?: string }) {
  res.cookies.set("jams_access", tokens.access, { httpOnly: true, sameSite: "lax", secure: isProd, path: "/", maxAge: 60 * 60 * 12 });
  if (tokens.refresh) res.cookies.set("jams_refresh", tokens.refresh, { httpOnly: true, sameSite: "lax", secure: isProd, path: "/", maxAge: 60 * 60 * 24 * 30 });
}

async function forward(request: NextRequest, pathParts: string[], attempt = 0, refreshed: false | { access: string; refresh?: string } = false): Promise<NextResponse> {
  const path = pathParts.map(encodeURIComponent).join("/");
  const url = new URL(`${API_BASE}/api/v1/${path}`);
  url.search = request.nextUrl.searchParams.toString();

  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const headers = new Headers();
  headers.set("Content-Type", request.headers.get("content-type") ?? "application/json");
  headers.set("X-Request-Id", requestId);
  headers.set("Accept", request.headers.get("accept") ?? "*/*");

  // auth: the client merely says "I want auth", the cookie never leaks to JS (§3.2)
  if (request.headers.get("x-use-auth") === "true") {
    const token = request.cookies.get("jams_access")?.value;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const wantsAuth = request.headers.get("x-use-auth") === "true";
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  } catch (e: any) {
    console.error(`[proxy] ${method} /api/v1/${path} → upstream error: ${e?.message}`);
    return NextResponse.json(
      { status: "failure", status_code: 502, message: "API unreachable", error: { code: "SOURCE_DOWN", detail: `Is the backend running on ${API_BASE}?` } },
      { status: 502, headers: { "X-Request-Id": requestId } }
    );
  }

  // expired access token → refresh once and retry (body is already buffered, so replay is safe)
  if (response.status === 401 && wantsAuth && !refreshed) {
    const buf = Buffer.from(await response.arrayBuffer());
    let code = "";
    try {
      code = JSON.parse(buf.toString("utf8"))?.error?.code ?? "";
    } catch {
      /* not JSON, leave code empty */
    }
    if (code === "TOKEN_EXPIRED" || code === "UNAUTHENTICATED") {
      const fresh = await refreshSession(request);
      if (!fresh) {
        // session is truly dead, bounce the cookies so the route guard sends them to login
        const dead = new NextResponse(buf, { status: 401, headers: { "content-type": "application/json", "X-Request-Id": requestId } });
        dead.cookies.delete("jams_access");
        dead.cookies.delete("jams_refresh");
        return dead;
      }
      headers.set("Authorization", `Bearer ${fresh.access}`);
      try {
        response = await fetch(url, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(30_000) });
        refreshed = fresh;
      } catch {
        return NextResponse.json(
          { status: "failure", status_code: 502, message: "API unreachable", error: { code: "SOURCE_DOWN", detail: `Is the backend running on ${API_BASE}?` } },
          { status: 502, headers: { "X-Request-Id": requestId } }
        );
      }
    }
  }

  // manual redirect following with a cap (reference behaviour, kept)
  if ([301, 302, 303, 307, 308].includes(response.status) && attempt < MAX_REDIRECTS) {
    const loc = response.headers.get("location");
    if (loc) {
      const nextUrl = new URL(loc, url);
      const rewritten = new NextRequest(nextUrl, { method, headers, body });
      return forward(rewritten, nextUrl.pathname.replace(/^\/api\/v1\//, "").split("/"), attempt + 1);
    }
  }

  const outHeaders = new Headers();
  const pass = ["content-type", "content-disposition", "cache-control", "etag", "retry-after", "x-ratelimit-limit", "x-ratelimit-remaining"];
  for (const h of pass) {
    const v = response.headers.get(h);
    if (v) outHeaders.set(h, v);
  }
  outHeaders.set("X-Request-Id", requestId);

  console.log(`[proxy] ${method} /api/v1/${path} → ${response.status} ${Date.now() - started}ms`);
  const res = new NextResponse(response.body, { status: response.status, headers: outHeaders });
  if (refreshed) sessionCookies(res, refreshed);
  return res;
}

async function handler(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(request, path);
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as HEAD, handler as OPTIONS };
