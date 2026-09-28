/**
 * Session cookies (§38.1 storage): the access token lives in a cookie readable by the
 * proxy + route guard, so app JS never touches it (reference pattern, tightened).
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const isProd = process.env.NODE_ENV === "production";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { access_token, refresh_token, role } = body ?? {};
  if (!access_token) {
    return NextResponse.json({ status: "failure", status_code: 400, message: "access_token required" }, { status: 400 });
  }
  const res = NextResponse.json({ status: "success", status_code: 200, message: "session set", data: { ok: true } });
  const maxAge = 60 * 60 * 12; // 12h access window; refresh handled server-side later
  res.cookies.set("jams_access", access_token, { httpOnly: true, sameSite: "lax", secure: isProd, path: "/", maxAge });
  if (refresh_token) res.cookies.set("jams_refresh", refresh_token, { httpOnly: true, sameSite: "lax", secure: isProd, path: "/", maxAge: 60 * 60 * 24 * 30 });
  if (role) res.cookies.set("jams_role", role, { httpOnly: false, sameSite: "lax", secure: isProd, path: "/", maxAge });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ status: "success", status_code: 200, message: "session cleared", data: { ok: true } });
  res.cookies.delete("jams_access");
  res.cookies.delete("jams_refresh");
  res.cookies.delete("jams_role");
  return res;
}
