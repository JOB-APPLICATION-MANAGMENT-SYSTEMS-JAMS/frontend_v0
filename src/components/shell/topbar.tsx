"use client";

/**
 * Sticky topbar, rail toggle (every breakpoint), page title, daily-goal ring + count,
 * theme, first-letter avatar (links to Profile). Log out lives in the rail footer.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PanelLeft } from "lucide-react";
import { GoalRing } from "./goal-ring";
import { ThemeToggle } from "./theme-toggle";
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
  "/autofill": "Autofill",
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
      <header className="glass-sheet sticky top-0 z-30 h-16">
        <div className="absolute inset-x-0 bottom-0 h-px bg-[image:var(--gradient-brand)] opacity-50" />
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4 md:px-6">
          <button
            type="button"
            onClick={onToggleRail}
            aria-label="Toggle navigation"
            aria-expanded={railOpen}
            aria-controls="app-rail"
            className="press grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-ember-deep dark:hover:text-ember-soft"
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
              className="press flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-1.5 transition-colors hover:bg-ember/10"
            >
              <GoalRing today={today} size={40} />
              <span className="tnum pr-1 text-xs font-bold">
                {today.count}/{today.goal}
              </span>
            </button>
          )}

          <ThemeToggle className="hidden sm:grid" />

          <Link
            href="/profile"
            title={fullName || "Profile"}
            className="press relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[image:var(--gradient-brand)] font-display text-sm font-extrabold text-primary-foreground shadow-[0_8px_20px_-10px_hsl(var(--ember)/0.9)] transition-transform duration-[var(--dur-3)] ease-[var(--ease-spring)] hover:scale-[1.08]"
          >
            {initial}
          </Link>
        </div>
      </header>
    </>
  );
}
