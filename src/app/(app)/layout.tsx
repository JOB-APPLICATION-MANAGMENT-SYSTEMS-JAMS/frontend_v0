"use client";

/**
 * App shell: one navigation surface, one content column, one command palette.
 * The header is sticky and the content simply follows it, so nothing has to be
 * offset by a measured rail width.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { CommandPalette } from "@/components/shell/cmd-k";

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        router.push("/discover");
      }
      if (e.key === "c") router.push("/tracker?new=1");
      if (e.key === "g") {
        const once = (e2: KeyboardEvent) => {
          const map: Record<string, string> = {
            d: "/discover",
            h: "/higher-as",
            s: "/studio",
            e: "/events",
            t: "/tracker",
            a: "/analytics",
          };
          if (map[e2.key]) router.push(map[e2.key]);
          window.removeEventListener("keydown", once);
        };
        window.addEventListener("keydown", once);
        setTimeout(() => window.removeEventListener("keydown", once), 1200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Topbar />
      <main
        data-dashboard-scroll-container
        className="route-fade flex-1 px-3 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:px-8"
      >
        {children}
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
