/**
 * Next 16's proxy (formerly middleware.ts) — auth guard with deep-link preservation:
 * unauthenticated access to a protected route → /auth/login?redirect=<full path+query>.
 */
import { NextRequest, NextResponse } from "next/server";
import { isProtected, isPublic } from "@/lib/route-config";

export const config = {
  // run on everything except static assets + the proxy/session routes themselves
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get("jams_access")?.value;

  if (isProtected(pathname) && !token) {
    const url = new URL("/auth/login", req.url);
    url.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/auth/login" || pathname === "/auth/signup") && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (isPublic(pathname) || isProtected(pathname)) return NextResponse.next();
  // unknown single-segment slugs are treated as public (reference behaviour, kept)
  return NextResponse.next();
}
