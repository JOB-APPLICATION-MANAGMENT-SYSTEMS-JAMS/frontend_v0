"use client";

/**
 * Left rail, one toggle drawer at every breakpoint (opened/closed from the navbar).
 * Exactly eight destinations, no group labels; log out lives in the rail footer.
 *
 * The order is the product's story: pick a direction (Dashboard), meet the market
 * (Discover), see who is hiring on JAMS (Hirers), write the document (Resume
 * Studio), show up (Events), then run the pipeline (Tracker, Outreach). Settings
 * closes the list. Autofill and Companies are still routes, but they are reached
 * from Profile and from a company link instead of costing a rail slot.
 * Navigation only auto-closes the drawer below md, laptops keep it open until the
 * toggle button (or Esc) closes it. Collapse is parked at the bottom as a comment.
 */
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  Columns3,
  Compass,
  FileText,
  LayoutDashboard,
  LogOut,
  Send,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearSession } from "@/lib/api/session";
import { Kbd } from "@/components/ui/base";
import { ConfirmDialog } from "@/components/ui/feedback";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass, kbd: "g d" },
  { href: "/hirers", label: "Hirers", icon: Briefcase },
  { href: "/studio", label: "Resume Studio", icon: FileText },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/tracker", label: "Tracker", icon: Columns3 },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppRail({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [confirmOut, setConfirmOut] = React.useState(false);

  // phones/tablets close the drawer after a tap; laptop widths leave it open
  // (tracked as an external store so hydration stays identical, no setState-in-effect)
  const isDesktop = React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false
  );

  // Below md the rail is an overlay: freeze the page behind the scrim so a swipe
  // scrolls the drawer, not the dashboard underneath it. Above md it is part of
  // the layout and the page must keep scrolling.
  React.useEffect(() => {
    if (isDesktop || !open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isDesktop, open]);

  const logout = async () => {
    await clearSession();
    router.push("/auth/login");
  };

  const item = (href: string, label: string, Icon: React.ComponentType<{ className?: string }>, kbd?: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          if (!isDesktop) onClose();
        }}
        data-active={active}
        className={cn(
          "rail-edge group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-[15px] font-medium transition-all duration-[var(--dur-2)] ease-[var(--ease-out)]",
          // the rail carries no brand hue at all: the active state is the same
          // glass, one step deeper, plus the dot on the right (see .rail-edge in
          // globals.css). No left-edge marker — it read as a stray black line.
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center transition-transform duration-[var(--dur-3)] ease-[var(--ease-spring)] group-hover:scale-110",
            active && "text-foreground"
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="flex-1 truncate">{label}</span>
        {kbd && <Kbd className="opacity-55 transition-opacity duration-200 group-hover:opacity-100">{kbd}</Kbd>}
        {active && <span className="animate-ember h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/35" />}
      </Link>
    );
  };

  return (
    <>
      {/* scrim, the rail overlays on small screens, pushes content from md up */}
      {open && <button type="button" aria-label="Close navigation" onClick={onClose} className="scrim-in fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" />}

      <aside
        id="app-rail"
        inert={!open}
        aria-label="Primary"
        className={cn(
          "glass-rail fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col gap-1 overflow-y-auto px-3 py-4 custom-scrollbar md:w-[240px]",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-4 flex items-center gap-2.5 px-2 py-1">
          <Image src="/jams-logo.png" alt="" width={403} height={322} className="h-8 w-auto shrink-0 drop-shadow-[0_6px_16px_rgb(12_12_12/0.2)] dark:drop-shadow-[0_6px_18px_rgb(0_0_0/0.55)]" />
          <span className="font-display text-lg font-extrabold tracking-tight">JAMS</span>
          <span className="glass-chip ml-auto rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">v1</span>
        </div>

        <nav className="stagger-children mt-3 flex flex-col gap-1.5">
          {NAV.map((r) => item(r.href, r.label, r.icon, r.kbd))}
        </nav>

        {/* account footer, log out lives here, not in the topbar */}
        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={() => setConfirmOut(true)}
            className="press group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-foreground transition-colors hover:bg-ink/10"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center transition-transform duration-[var(--dur-3)] ease-[var(--ease-out)] group-hover:translate-x-0.5">
              <LogOut className="h-[18px] w-[18px]" />
            </span>
            Log out
          </button>
        </div>

        {/* Collapse parked for now, the rail is a plain toggle drawer.
        <div className="mt-auto pt-4">
          <button onClick={onToggle} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5">
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && "Collapse"}
          </button>
        </div>
        */}
      </aside>

      <ConfirmDialog
        open={confirmOut}
        title="Are you sure you want to log out?"
        description="Your tracker, CVs and outreach stay saved, you'll just need to sign in again."
        confirmLabel="Log out"
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          logout();
        }}
      />
    </>
  );
}
