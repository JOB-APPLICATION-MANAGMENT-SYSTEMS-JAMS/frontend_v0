"use client";

/**
 * Sticky topbar, rail toggle (every breakpoint), page title, daily-goal ring + count,
 * theme, first-letter avatar (links to Profile). Log out lives in the rail footer.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Moon, PanelLeft, Sun } from "lucide-react";
import { GoalRing } from "./goal-ring";
import { qk } from "@/lib/queries";
import { appFetch } from "@/lib/api";
import type { Today } from "@/types";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/discover": "Discover",
  "/tracker": "Tracker",
  "/studio": "CV Studio",
  "/outreach": "Outreach",
  "/profile": "Profile",
  "/streaks": "Streaks",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/inbox-sync": "Inbox sync",
  "/capture": "Quick capture",
  "/victory": "Victory",
  "/companies": "Companies",
};

export function Topbar({ railOpen, onToggleRail }: { railOpen: boolean; onToggleRail: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const { data: today } = useQuery<Today>({
    queryKey: qk.today(),
    queryFn: () => appFetch("/streaks/today", { _auth: true }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const profile = useQuery<{ identity?: { full_name?: string; name?: string } }>({
    queryKey: qk.profile(),
    queryFn: () => appFetch("/profile", { _auth: true }),
    staleTime: 60_000,
  });
  const me = useQuery<{ email?: string }>({ queryKey: qk.me(), queryFn: () => appFetch("/auth/me", { _auth: true }), staleTime: 60_000 });

  const fullName = profile.data?.identity?.full_name ?? profile.data?.identity?.name ?? "";
  const initial = (fullName.trim().charAt(0) || me.data?.email?.charAt(0) || "?").toUpperCase();

  const title =
    Object.entries(TITLES).find(([href]) => pathname === href || pathname.startsWith(`${href}/`))?.[1] ??
    (pathname.startsWith("/applications")
      ? "Application"
      : pathname.startsWith("/companies")
        ? "Company"
        : pathname.startsWith("/studio/")
          ? "CV editor"
          : "JAMS");

  return (
    <>
      <header className="glass-sheet sticky top-0 z-30 h-16 border-b border-black/5 dark:border-white/10">
        <div className="absolute inset-x-0 bottom-0 h-px bg-[image:var(--gradient-brand)] opacity-40" />
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4 md:px-6">
          <button
            type="button"
            onClick={onToggleRail}
            aria-label="Toggle navigation"
            aria-expanded={railOpen}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelLeft className="h-4.5 w-4.5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-bold leading-tight sm:text-lg">{title}</h1>
          </div>

          {/* daily goal, 40px ring, dead-centre, count beside it */}
          {today && (
            <button
              type="button"
              onClick={() => router.push("/streaks")}
              title={`${today.count}/${today.goal} today`}
              className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-1.5 transition-colors hover:bg-muted"
            >
              <GoalRing today={today} size={40} />
              <span className="tnum pr-1 text-xs font-bold">
                {today.count}/{today.goal}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted sm:grid"
            aria-label="Toggle theme"
          >
            {/* both icons rendered statically, visibility is CSS-driven via html.dark so server and
                client markup always match (resolvedTheme differs during hydration) */}
            <Sun className="hidden h-4.5 w-4.5 dark:block" />
            <Moon className="block h-4.5 w-4.5 dark:hidden" />
          </button>

          <Link
            href="/profile"
            title={fullName || "Profile"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-extrabold text-primary-foreground transition-transform hover:scale-105"
          >
            {initial}
          </Link>
        </div>
      </header>
    </>
  );
}
