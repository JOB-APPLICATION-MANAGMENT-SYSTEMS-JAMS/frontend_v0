"use client";

/**
 * The two controls that let someone choose from a set: a filtering combobox for
 * long lists and the sliding segmented control for short ones.
 *
 * Both are keyboard-first — the combobox keeps focus on its input while the list
 * is open (so the blur handler cannot race the click) and the segmented control is
 * a real `role="tablist"` whose segments are buttons.
 */
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------ Combobox ------------------------------- */
/** Type-to-filter select for long lists (countries, 90+ entries). A native
 *  <select> forces an alphabetical scroll hunt past ~15 items (§6); this filters
 *  as you type, keeps the selected value visible, and stays keyboard-reachable
 *  (Enter picks the top match, Escape closes, the rows are real buttons). */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Search…",
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const wrap = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const selected = options.find((o) => o.value === value);
  const needle = q.trim().toLowerCase();
  const filtered = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };

  // close on any pointer press outside the wrapper
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-label={ariaLabel}
        value={open ? q : (selected?.label ?? "")}
        placeholder={selected?.label ? selected.label : placeholder}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          setOpen(true);
          setQ("");
        }}
        onBlur={(e) => {
          if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQ("");
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered.length) pick(filtered[0].value);
          }
        }}
        className={cn(
          "glass-input h-10 w-full rounded-xl px-3.5 text-sm text-foreground placeholder:text-muted-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className
        )}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card py-1 shadow-2xl">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">No match for “{q.trim()}”</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  // keep focus on the input so the blur handler doesn't race the click
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.value)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                    o.value === value ? "bg-muted font-semibold text-foreground" : "text-foreground hover:bg-muted"
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
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
