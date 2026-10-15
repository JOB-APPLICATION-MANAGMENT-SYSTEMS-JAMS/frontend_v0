"use client";

/**
 * Layout vocabulary — the structural half of the design system.
 *
 * Every page used to hand-roll its own heading, spacing and filter pills, which
 * is exactly why the app read as a collection of screens instead of one product.
 * These primitives fix the rhythm once:
 *
 *   PageShell          one max-width, one vertical rhythm, for every route
 *   PageHeader         eyebrow · title · description · actions, always the same shape
 *   Section            a titled glass region (charts, tables, forms)
 *   Toolbar            filter/action strip that sits above content
 *
 * All of them are presentation-only: no data, no queries, no routing.
 *
 * The controls a page puts *inside* these regions live in their own files now:
 * `menu.tsx` (Combobox, SegmentedControl), `toggle.tsx` (Switch, Checkbox),
 * `display.tsx` (Chip, Stat, Badge…).
 */
import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------ PageShell ------------------------------- */
export function PageShell({ children, className, width = "default" }: { children: React.ReactNode; className?: string; width?: "default" | "wide" | "narrow" }) {
  const w = width === "wide" ? "max-w-[1600px]" : width === "narrow" ? "max-w-3xl" : "max-w-[1360px]";
  return <div className={cn("mx-auto w-full space-y-6 sm:space-y-7", w, className)}>{children}</div>;
}

/* ------------------------------ PageHeader ------------------------------ */
/** The masthead of a route: a mono eyebrow, a display title, one line of intent,
 *  and the actions aligned to the baseline on desktop, stacked on phones. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("animate-fade-in-up", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="eyebrow flex items-center gap-1.5">
              {icon}
              {eyebrow}
            </p>
          )}
          <h1 className="font-display mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight text-foreground sm:text-[32px]">
            {title}
          </h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <hr className="divider-ember mt-5" />
    </header>
  );
}

/* -------------------------------- Section ------------------------------- */
/** A titled glass region. `action` sits on the header baseline; `plain` drops the
 *  glass when the child already brings its own surface. */
export function Section({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  plain = false,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  plain?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={cn(plain ? "" : "glass-card rounded-2xl p-4 sm:p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="eyebrow flex items-center gap-1.5">{title}</h2>}
            {description && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* -------------------------------- Toolbar ------------------------------- */
/** Horizontal filter/action strip. Scrolls sideways on phones instead of wrapping
 *  into three ragged rows, and never exceeds the viewport. */
export function Toolbar({ children, className, sticky = false }: { children: React.ReactNode; className?: string; sticky?: boolean }) {
  return (
    <div
      className={cn(
        "glass-sheet -mx-1 flex items-center gap-2 overflow-x-auto rounded-2xl px-3 py-2.5 no-scrollbar sm:mx-0",
        sticky && "sticky top-[68px] z-20",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarSpacer() {
  return <span className="ml-auto shrink-0" />;
}
