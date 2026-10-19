"use client";

/**
 * Theme toggle with a circular reveal.
 *
 * Instead of a hard class flip, the incoming theme is clipped into a circle that
 * expands from the button you pressed (View Transitions API, Chromium today).
 * The animation itself lives in globals.css (`themeReveal`) and reads the origin
 * from `--vt-x` / `--vt-y`, which we set from the real pointer position.
 *
 * Everything degrades: no `startViewTransition` → a plain class swap, and
 * `prefers-reduced-motion` skips the reveal entirely.
 */
import * as React from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const ref = React.useRef<HTMLButtonElement>(null);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const doc = document as ViewTransitionDocument;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = ref.current?.getBoundingClientRect();
    const x = Math.round(e.clientX || (rect ? rect.left + rect.width / 2 : window.innerWidth - 48));
    const y = Math.round(e.clientY || (rect ? rect.top + rect.height / 2 : 24));

    if (!doc.startViewTransition || reduced) {
      setTheme(next);
      return;
    }

    const root = document.documentElement;
    root.style.setProperty("--vt-x", `${x}px`);
    root.style.setProperty("--vt-y", `${y}px`);
    // flushSync so next-themes has actually written the class to <html> before the
    // API snapshots the "new" frame - otherwise the reveal animates a stale page
    const transition = doc.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });
    transition.finished.finally(() => {
      root.style.removeProperty("--vt-x");
      root.style.removeProperty("--vt-y");
    });
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      title="Switch theme"
      aria-label="Switch between light and dark theme"
      className={cn(
        "glass-tab grid h-9 w-9 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl text-muted-foreground transition-all duration-[var(--dur-2)] hover:border-ember/45 hover:text-ember-deep dark:hover:text-ember-soft",
        className
      )}
    >
      {/* both icons render statically and CSS picks one off `html.dark`, so server
          and client markup always match (resolvedTheme differs during hydration) */}
      <Sun className="hidden h-4 w-4 transition-transform duration-[var(--dur-3)] ease-[var(--ease-spring)] dark:block dark:hover:rotate-45" />
      <Moon className="block h-4 w-4 transition-transform duration-[var(--dur-3)] ease-[var(--ease-spring)] hover:-rotate-12 dark:hidden" />
    </button>
  );
}
