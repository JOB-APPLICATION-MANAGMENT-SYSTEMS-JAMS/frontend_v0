"use client";

/**
 * The shell's one navigation surface.
 *
 * Primary destinations are *words*, set in an italic serif: Discover, Higher As,
 * Resume Studio, Events. They sit in the header on desktop and in their own
 * one-hand row on phones, where a thumb can reach them without opening anything.
 *
 * Everything else is secondary and icon-sized: Tracker analytics, Settings, the
 * daily goal, theme and the account menu. There is no second drawer to learn.
 */
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarDays, Compass, FileText, HardHat, LogOut, Settings, User } from "lucide-react";
import { GoalRing } from "./goal-ring";
import { ThemeToggle } from "./theme-toggle";
import { qk } from "@/lib/queries";
import { appFetch } from "@/lib/api";
import { clearSession } from "@/lib/api/session";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/feedback";
import type { Today } from "@/types";

const PRIMARY = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/higher-as", label: "Higher As", icon: HardHat },
  { href: "/studio", label: "Resume Studio", icon: FileText },
  { href: "/events", label: "Events", icon: CalendarDays },
];

const SECONDARY = [
  { href: "/analytics", label: "Tracker analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [confirmOut, setConfirmOut] = React.useState(false);

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
  // /auth/me wraps the account in `user`; reading `email` off the root silently
  // produced a "?" avatar for every account.
  const me = useQuery<{ user?: { email?: string; role?: string } }>({
    queryKey: qk.me(),
    queryFn: () => appFetch("/auth/me", { _auth: true }),
    staleTime: 60_000,
  });

  const email = me.data?.user?.email ?? "";
  const fullName = profile.data?.identity?.full_name?.trim() || profile.data?.identity?.name?.trim() || "";
  const initial = (fullName.charAt(0) || email.charAt(0) || "?").toUpperCase();
  const isReviewer = me.data?.user?.role === "admin";

  React.useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accountOpen]);

  const logout = async () => {
    await clearSession();
    router.push("/auth/login");
  };

  const link = (item: (typeof PRIMARY)[number]) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          // 44px under a thumb, 40px under a cursor
          "nav-script relative flex h-11 shrink-0 items-center whitespace-nowrap px-0.5 text-[17px] leading-none transition-colors duration-[var(--dur-2)] md:h-10",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {item.label}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-[image:var(--gradient-brand)] transition-transform duration-[var(--dur-3)] ease-[var(--ease-out)]",
            active && "scale-x-100"
          )}
        />
      </Link>
    );
  };

  return (
    <>
      <header className="glass-sheet sticky top-0 z-30">
        <div className="absolute inset-x-0 bottom-0 h-px bg-[image:var(--gradient-brand)] opacity-50" />

        <div className="flex h-14 items-center gap-2 px-3 sm:gap-4 sm:px-5 md:h-16 md:px-6">
          <Link href="/discover" className="flex shrink-0 items-center gap-2" aria-label="JAMS home">
            <Image
              src="/jams-logo.png"
              alt=""
              width={403}
              height={322}
              className="h-7 w-auto shrink-0 drop-shadow-[0_6px_16px_rgb(12_12_12/0.2)] dark:drop-shadow-[0_6px_18px_rgb(0_0_0/0.55)] md:h-8"
            />
            <span className="font-display text-base font-extrabold tracking-tight md:text-lg">JAMS</span>
          </Link>

          {/* primary destinations, in the header from md up */}
          <nav aria-label="Primary" className="ml-2 hidden items-center gap-5 md:flex">
            {PRIMARY.map(link)}
          </nav>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {today && (
              <button
                type="button"
                onClick={() => router.push("/streaks")}
                title={`${today.count}/${today.goal} today`}
                aria-label={`Daily goal, ${today.count} of ${today.goal}`}
                className="press hidden h-9 items-center justify-center gap-1.5 rounded-full px-1 transition-colors hover:bg-ember/10 sm:flex"
              >
                <GoalRing today={today} size={34} />
                <span className="tnum pr-1 text-[11px] font-bold">
                  {today.count}/{today.goal}
                </span>
              </button>
            )}

            {SECONDARY.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={cn(
                  "press grid h-9 w-9 place-items-center rounded-xl transition-colors",
                  isActive(pathname, href) ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </Link>
            ))}

            <ThemeToggle className="hidden sm:grid" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label="Account menu"
                title={fullName || "Account"}
                className="press ml-0.5 grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[image:var(--gradient-brand)] font-display text-sm font-extrabold text-primary-foreground shadow-[0_8px_20px_-10px_hsl(var(--ember)/0.9)] transition-transform duration-[var(--dur-3)] ease-[var(--ease-spring)] hover:scale-[1.06]"
              >
                {initial}
              </button>

              {accountOpen && (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setAccountOpen(false)}
                  />
                  <div
                    role="menu"
                    aria-label="Account"
                    className="glass-panel sheet-in absolute right-0 top-11 z-50 w-60 rounded-2xl p-1.5"
                  >
                    <div className="px-2.5 py-2">
                      <p className="truncate text-[13px] font-semibold">{fullName || "Your account"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{email}</p>
                    </div>
                    <div className="my-1 h-px bg-border" />
                    <Link
                      href="/profile"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <User className="h-4 w-4" /> View profile
                    </Link>
                    <Link
                      href="/settings"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Settings className="h-4 w-4" /> Account and preferences
                    </Link>
                    {isReviewer && (
                      <Link
                        href="/higher-as/review"
                        role="menuitem"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <BarChart3 className="h-4 w-4" /> Verification queue
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountOpen(false);
                        setConfirmOut(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-ink/10"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* phones: the same destinations as words, in a reachable row of their own */}
        <nav
          aria-label="Primary"
          className="no-scrollbar fade-x flex items-center gap-5 overflow-x-auto px-4 pb-1.5 md:hidden"
        >
          {PRIMARY.map(link)}
        </nav>
      </header>

      <ConfirmDialog
        open={confirmOut}
        title="Sign out of JAMS?"
        description="Your tracker, resumes and Higher As profile stay saved. You will just need to sign in again."
        confirmLabel="Sign out"
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          void logout();
        }}
      />
    </>
  );
}
