/**
 * Declarative route registry (§41.4), same shape as the reference's route-config.
 * proxy.ts (Next 16's middleware) reads these tables to guard routes.
 */
export const publicRoutes = ["/", "/auth/login", "/auth/signup", "/auth/verify", "/legal"];

export const authedRoutes = [
  "/dashboard",
  "/discover",
  "/tracker",
  "/applications",
  "/companies",
  "/studio",
  "/outreach",
  "/profile",
  "/streaks",
  "/analytics",
  "/settings",
  "/inbox-sync",
  "/capture",
  "/victory",
];

export function isPublic(pathname: string): boolean {
  return publicRoutes.some((r) => (r === "/" ? pathname === "/" : pathname === r || pathname.startsWith(`${r}/`)));
}

export function isProtected(pathname: string): boolean {
  return authedRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** Route group for the Prism shutter: transitions only fire between these groups (§15.1). */
export function routeGroup(pathname: string): "auth" | "app" | "root" {
  if (pathname.startsWith("/auth") || pathname === "/onboarding") return "auth";
  if (isProtected(pathname)) return "app";
  return "root";
}
