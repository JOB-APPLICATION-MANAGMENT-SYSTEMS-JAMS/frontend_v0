"use client";

/**
 * Left rail, one toggle drawer at every breakpoint (opened/closed from the navbar).
 * Exactly seven destinations, no group labels; log out lives in the rail footer.
 * Navigation only auto-closes the drawer below md, laptops keep it open until the
 * toggle button (or Esc) closes it. Collapse is parked at the bottom as a comment.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Columns3,
  Compass,
  FileText,
  LayoutDashboard,
  LogOut,
  Send,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/base";
import { ConfirmDialog } from "@/components/ui/feedback";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass, kbd: "g d" },
  { href: "/tracker", label: "Tracker", icon: Columns3 },
  { href: "/studio", label: "CV Studio", icon: FileText },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/companies", label: "Companies", icon: Building2 },
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

  const logout = async () => {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/auth/login");
  };

  const item = (href: string, label: string, Icon: React.ComponentType<{ className?: string }>, kbd?: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => {
          if (!isDesktop) onClose();
        }}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-all duration-200",
          active
            ? "bg-white/70 text-ink shadow-sm dark:bg-white/10 dark:text-white"
            : "text-muted-foreground hover:bg-white/50 hover:text-foreground dark:hover:bg-white/5"
        )}
      >
        <span className={cn("grid h-6 w-6 shrink-0 place-items-center", active && "text-primary")}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="flex-1">{label}</span>
        {kbd && <Kbd>{kbd}</Kbd>}
        {active && <span className="h-1.5 w-1.5 rounded-full bg-[image:var(--gradient-brand)]" />}
      </Link>
    );
  };

  return (
    <>
      {/* scrim, the rail overlays on small screens, pushes content from md up */}
      {open && <button type="button" aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" />}

      <aside
        inert={!open}
        className={cn(
          "glass-rail fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col gap-1 overflow-y-auto px-3 py-4 custom-scrollbar md:w-[240px]",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-4 flex items-center gap-2 px-2">
          <img src="/jams-logo.png" alt="" className="h-8 w-auto shrink-0" />
          <span className="font-display text-lg font-extrabold tracking-tight">JAMS</span>
        </div>

        <nav className="mt-3 flex flex-col gap-1.5">
          {NAV.map((r) => item(r.href, r.label, r.icon, r.kbd))}
        </nav>

        {/* account footer, log out lives here, not in the topbar */}
        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={() => setConfirmOut(true)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-danger transition-colors hover:bg-danger/10"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center">
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
