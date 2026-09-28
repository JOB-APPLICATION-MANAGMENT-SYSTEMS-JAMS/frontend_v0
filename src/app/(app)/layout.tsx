"use client";

/** App shell (§40.2): navbar (toggle · title · goal ring · avatar) + rail (7 items + log out) + main + ⌘K. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { AppRail } from "@/components/shell/app-rail";
import { Topbar } from "@/components/shell/topbar";
import { CommandPalette } from "@/components/shell/cmd-k";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // the rail starts open on laptop widths, closed on phones — tracked as an external store
  // so hydration stays identical on both sides (no setState-in-effect)
  const isDesktop = React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false
  );
  const [navChoice, setNavChoice] = React.useState<boolean | null>(null); // null = follow the viewport
  const navOpen = navChoice ?? isDesktop;
  const setNavOpen = React.useCallback((v: boolean) => setNavChoice(v), []);

  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setNavOpen(false);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        router.push("/discover");
      }
      if (e.key === "c") router.push("/tracker?new=1");
      // g-then-d chord
      if (e.key === "g") {
        const once = (e2: KeyboardEvent) => {
          if (e2.key === "d") router.push("/dashboard");
          if (e2.key === "t") router.push("/tracker");
          if (e2.key === "a") router.push("/analytics");
          window.removeEventListener("keydown", once);
        };
        window.addEventListener("keydown", once);
        setTimeout(() => window.removeEventListener("keydown", once), 1200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, setNavOpen]);

  return (
    <div className="flex min-h-dvh">
      <AppRail open={navOpen} onClose={() => setNavOpen(false)} />

      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-300", navOpen && "md:pl-[240px]")}>
        <Topbar railOpen={navOpen} onToggleRail={() => setNavOpen(!navOpen)} />
        <main data-dashboard-scroll-container className="route-fade flex-1 px-4 py-6 md:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
