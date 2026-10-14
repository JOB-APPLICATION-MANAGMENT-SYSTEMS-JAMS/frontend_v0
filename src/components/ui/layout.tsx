"use client";

/**
 * Layout vocabulary — the structural half of the design system.
 *
 * Every page used to hand-roll its own heading, spacing and filter pills, which
 * is exactly why the app read as a collection of screens instead of one product.
 * These five primitives fix the rhythm once:
 *
 *   PageShell          one max-width, one vertical rhythm, for every route
 *   PageHeader         eyebrow · title · description · actions, always the same shape
 *   Section            a titled glass region (charts, tables, forms)
 *   Toolbar            filter/action strip that sits above content
 *   SegmentedControl   the sliding-pill switch that replaces 6 copies of pill markup
 *
 * All of them are presentation-only: no data, no queries, no routing.
 */
import * as React from "react";
import { Check } from "lucide-react";
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

/* --------------------------- SegmentedControl --------------------------- */
/**
 * The one switch in the product. Everything that used to be a bespoke row of
 * pills (period, board/list, discover mode, remote, sort) comes through here.
 *
 * Two rules make it look right:
 *   1. every segment is the SAME width (`flex-1 basis-0`), which is what lets a
 *      single translated indicator line up with its label. Sizing segments to
 *      their text made the pill drift off the label it belonged to.
 *   2. the track is recessed (inset shadow) and the indicator is a raised pill,
 *      so the selected segment reads as physical rather than as a stray button.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  size = "default",
  stretch = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "default";
  stretch?: boolean;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const n = Math.max(1, options.length);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "glass-track relative flex shrink-0 rounded-full p-1",
        "shadow-[inset_0_1px_3px_rgb(0_0_0/0.07)] dark:shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)]",
        stretch ? "w-full" : "w-fit",
        className
      )}
    >
      {/* the travelling indicator */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-[image:var(--gradient-brand)] shadow-[0_1px_0_rgb(255_255_255/0.35)_inset,0_4px_12px_-6px_hsl(var(--ember)/0.9)] transition-transform duration-[var(--dur-3)] ease-[var(--ease-out)]"
        style={{ width: `calc((100% - 0.5rem) / ${n})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 inline-flex flex-1 basis-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold capitalize transition-colors duration-[var(--dur-2)]",
              size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs sm:px-3.5",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
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

/* -------------------------------- Switch -------------------------------- */
/**
 * The on/off control. A real `role="switch"` button, not a styled checkbox, so
 * Space/Enter and screen readers behave without extra wiring.
 *
 * Always rendered with its label: a bare toggle leaves the user guessing what it
 * governs, which is exactly what made the old auto-send row on Pitch targets read
 * as decoration rather than state.
 */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("glass-chip flex items-center gap-3 rounded-xl px-3 py-2", disabled && "opacity-60", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        aria-label={typeof label === "string" ? label : undefined}
        onClick={() => onChange(!checked)}
        /* the bead is painted by .glass-switch::after, not by markup: a read-only
           state indicator (data-on) then needs nothing but the one element */
        className="glass-switch touch-slop relative h-6 w-11 shrink-0 cursor-pointer rounded-full disabled:cursor-not-allowed"
      />
      <span className="min-w-0 leading-tight">
        <span className="block text-xs font-semibold text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </div>
  );
}

/* ------------------------------- Checkbox ------------------------------- */
/**
 * A checkbox that belongs to this design system. A raw `<input type="checkbox">`
 * paints an OS control that ignores the palette entirely — in the tracker's list
 * view it was the only blue-ish, sharp-cornered thing on a warm glass page.
 * Keyboard and screen-reader behaviour is unchanged: it is still a real input.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <span className={cn("relative inline-grid h-[18px] w-[18px] shrink-0 place-items-center", className)}>
        <input
          ref={ref}
          type="checkbox"
          className={cn(
            "peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-md border border-input bg-transparent",
            "transition-all duration-[var(--dur-2)] ease-[var(--ease-out)]",
            "hover:border-ember/60",
            "checked:border-transparent checked:bg-[image:var(--gradient-brand)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          )}
          {...props}
        />
        <Check className="pointer-events-none h-3 w-3 scale-75 text-primary-foreground opacity-0 transition-all duration-[var(--dur-2)] ease-[var(--ease-spring)] peer-checked:scale-100 peer-checked:opacity-100" />
      </span>
    );
  }
);

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
