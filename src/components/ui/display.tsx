"use client";

/**
 * Display atoms: surfaces, labels, figures and the pager.
 *
 * These are the pieces that make a number or a status *readable* rather than the
 * pieces that lay a page out (see `layout.tsx`) or take input (see `input.tsx`).
 * They share one rule: every tone is a rung of the same hue, so a badge reads as a
 * level of emphasis rather than as a different colour.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/* -------------------------------- Card --------------------------------- */
export function Card({ className, interactive, ...props }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={cn("glass-card rounded-2xl", interactive && "glass-hover cursor-pointer", className)} {...props} />;
}

/* -------------------------------- Badge -------------------------------- */
export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "mint" | "azure" | "orchid" | "amber" | "rose" }) {
  /* every tone is a rung of the same hue: the badge reads as a *level* of
     emphasis, and the neutral rung is the only hue-free one (used for "stop"). */
  const tones = {
    neutral: "bg-muted text-muted-foreground border-border",
    mint: "bg-ember/14 text-ember-ink dark:text-ember-soft border-ember/35",
    azure: "bg-ember/16 text-ember-deep dark:text-ember border-ember/45",
    orchid: "bg-ink/10 text-ink border-ink/25",
    amber: "bg-ember-soft/22 text-ember-ink dark:text-ember-soft border-ember/30",
    rose: "bg-ink/8 text-foreground border-ink/30",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tones[tone], className)}
      {...props}
    />
  );
}

/* ------------------------------ Skeleton ------------------------------- */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

/* --------------------------------- Kbd --------------------------------- */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold text-muted-foreground", className)}>
      {children}
    </kbd>
  );
}

/* ----------------------------- ProgressBar ----------------------------- */
export function ProgressBar({ value, className, gradient = true }: { value: number; className?: string; gradient?: boolean }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", gradient ? "bg-[image:var(--gradient-brand)]" : "bg-primary")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ------------------------------ IconChip -------------------------------- */
export function IconChip({ children, tone = "mint" }: { children: React.ReactNode; tone?: "mint" | "azure" | "orchid" | "amber" | "rose" | "slate" }) {
  const tones = {
    mint: "bg-ember/16 text-ember-ink dark:text-ember-soft",
    azure: "bg-ember/20 text-ember-deep dark:text-ember",
    orchid: "bg-ink/10 text-ink",
    amber: "bg-ember-soft/24 text-ember-ink dark:text-ember-soft",
    rose: "bg-ink/8 text-foreground",
    slate: "bg-muted text-muted-foreground",
  };
  return <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-[var(--dur-3)] ease-[var(--ease-spring)]", tones[tone])}>{children}</span>;
}

/* -------------------------------- Chip ---------------------------------- */
/**
 * A filter chip. One look for every filterable list in the product: a glass pill
 * that charges with the accent when `active`, and is announced as pressed.
 *
 * Replaces the hand-rolled chips that used to differ per page (bordered boxes in
 * one place, tinted rounds in another, `glass-tab` groups in a third) — on the
 * Discover screen alone four idioms sat within 200px of each other.
 */
export function Chip({
  active,
  children,
  onClick,
  title,
  className,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
      title={title}
      className={cn(
        "glass-chip inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
        "transition-all duration-[var(--dur-2)] ease-[var(--ease-out)] active:scale-[0.97]",
        !active && "text-muted-foreground hover:border-ember/45 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------------- Stat --------------------------------- */
/** Label / value / hint in one block, used by victory totals, drawers and summaries. */
export function Stat({ label, value, hint, className }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-muted/40 px-3 py-2.5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="hero-num mt-1 text-2xl text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("divider-ember", className)} />;
}

/** Prev / numbered pages / next, plus a "showing x–y of z" line. Reused by every list view. */
export function Pager({
  page,
  pageSize,
  totalCount,
  onPage,
  className,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(totalCount, page * pageSize);

  // window of page numbers around the current one: 1 … 4 5 6 … 20
  const pages: number[] = [];
  for (const p of [1, page - 1, page, page + 1, totalPages]) {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p);
  }
  pages.sort((a, b) => a - b);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-xs text-muted-foreground">
        Showing <span className="tnum font-semibold">{from}–{to}</span> of <span className="tnum font-semibold">{totalCount}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Button>
        {pages.map((p, i) => (
          <React.Fragment key={p}>
            {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-xs text-muted-foreground">…</span>}
            <Button size="sm" variant={p === page ? "azure" : "ghost"} onClick={() => onPage(p)} className="tnum">
              {p}
            </Button>
          </React.Fragment>
        ))}
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
