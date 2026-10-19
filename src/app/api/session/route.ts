/**
 * Session cookies (§38.1 storage): the access token lives in a cookie readable by the
 * proxy + route guard, so app JS never touches it (reference pattern, tightened).
 */
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAMES } from "@/lib/cookies";

export const runtime = "nodejs";

/*
 * Secure comes from the request scheme, not NODE_ENV: a production build served
 * over plain http (a local `next start`, a LAN preview) would otherwise emit
 * Secure cookies the browser silently drops, so sign-in "succeeds" and every
 * request after it is anonymous.
 */
const isSecure = (req: NextRequest) => req.nextUrl.protocol === "https:";

export async function POST(req: NextRequest) {
  const secure = isSecure(req);
  const body = await req.json().catch(() => ({}));
  const { access_token, refresh_token, role } = body ?? {};
  if (!access_token) {
    return NextResponse.json({ status: "failure", status_code: 400, message: "access_token required" }, { status: 400 });
  }
  const res = NextResponse.json({ status: "success", status_code: 200, message: "session set", data: { ok: true } });
  const maxAge = 60 * 60 * 12; // 12h access window; refresh handled server-side later
  res.cookies.set(COOKIE_NAMES.ACCESS_TOKEN, access_token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge });
  if (refresh_token) res.cookies.set(COOKIE_NAMES.REFRESH_TOKEN, refresh_token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 30 });
  if (role) res.cookies.set(COOKIE_NAMES.USER_ROLE, role, { httpOnly: false, sameSite: "lax", secure, path: "/", maxAge });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ status: "success", status_code: 200, message: "session cleared", data: { ok: true } });
  res.cookies.delete(COOKIE_NAMES.ACCESS_TOKEN);
  res.cookies.delete(COOKIE_NAMES.REFRESH_TOKEN);
  res.cookies.delete(COOKIE_NAMES.USER_ROLE);
  return res;
}
