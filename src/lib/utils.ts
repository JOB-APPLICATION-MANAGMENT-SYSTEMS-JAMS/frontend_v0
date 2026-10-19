import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmt = {
  n: (v: number | null | undefined) => (v == null ? "n/a" : Number(v).toLocaleString()),
  pct: (v: number | null | undefined) => (v == null ? "n/a" : `${Number(v).toFixed(1)}%`),
  delta: (v: number | null | undefined) => {
    if (v == null) return "n/a";
    if (v === 0) return "±0%";
    return `${v > 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(1)}%`;
  },
  date: (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "n/a"),
  dateTime: (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "n/a"),
  ago: (iso?: string | null) => {
    if (!iso) return "n/a";
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86_400_000);
    if (d <= 0) {
      const h = Math.floor(diff / 3_600_000);
      if (h <= 0) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
      return `${h}h ago`;
    }
    return `${d}d ago`;
  },
  days: (n: number | null | undefined) => (n == null ? "n/a" : `${Math.round(n)}d`),
};

/*
 * Pipeline status, expressed as HEAT rather than as eight unrelated hues.
 *
 * Every progressing stage is the same hue (#ff9933, hue 30) at rising lightness,
 * so the tracker reads as a temperature scale: cold grey for something you never
 * touched, hotter as you get closer to an offer. The two dead ends (rejected,
 * ghosted) and the one you pulled yourself (withdrawn) drop out of the ramp into
 * pure grey/ink - the only hue-free steps, which is what makes them read as "off".
 *
 * The steps are mid-range on purpose so they stay legible on white AND on black.
 * `color` is a plain CSS colour string, `borderColor`/`bgColor` bake in the alpha
 * (call sites used to do `${color}66`, which cannot work with a var() colour).
 */
/* The rungs live in globals.css as `--st-*` so each theme can pick the lightness
   that actually clears its background - a dark rung is readable on white and
   invisible on black, so a single literal cannot serve both. */
const step = {
  saved: "--st-saved",
  applied: "--st-applied",
  viewed: "--st-viewed",
  screen: "--st-screen",
  interview: "--st-interview",
  offer: "--st-offer",
  rejected: "--st-rejected",
  ghosted: "--st-ghosted",
  withdrawn: "--st-withdrawn",
} as const;

export type StatusMeta = { label: string; color: string; borderColor: string; bgColor: string; bg: string; border: string };

const h = (v: string, a = 1) => (a === 1 ? `hsl(var(${v}))` : `hsl(var(${v}) / ${a})`);

/* bg/border are real, literal Tailwind classes (never string-built: Tailwind only
   emits classes it can see in the source). The exact rung is carried by the
   inline colour, which is allowed to be dynamic. */
const meta = (label: string, s: string, bg: string, border: string): StatusMeta => ({
  label,
  color: h(s),
  borderColor: h(s, 0.42),
  bgColor: h(s, 0.12),
  bg,
  border,
});

/** Keyed loosely on purpose: the stage always arrives as a string from the API. */
export const STATUS_META: Record<string, StatusMeta> = {
  saved: meta("Saved", step.saved, "bg-muted", "border-border"),
  applied: meta("Applied", step.applied, "bg-ember/12", "border-ember/35"),
  viewed: meta("Viewed", step.viewed, "bg-ember/14", "border-ember/40"),
  screen: meta("Screen", step.screen, "bg-ember/16", "border-ember/45"),
  interview: meta("Interview", step.interview, "bg-ember/20", "border-ember/50"),
  offer: meta("Offer", step.offer, "bg-ember/25", "border-ember/60"),
  rejected: meta("Rejected", step.rejected, "bg-ink/8", "border-ink/30"),
  ghosted: meta("Ghosted", step.ghosted, "bg-muted", "border-border"),
  withdrawn: meta("Withdrawn", step.withdrawn, "bg-muted", "border-border"),
};

export function statusMeta(status: string): StatusMeta | undefined {
  return STATUS_META[status];
}

export const BOARD_COLUMNS = ["saved", "applied", "viewed", "screen", "interview", "offer", "rejected", "ghosted"] as const;
