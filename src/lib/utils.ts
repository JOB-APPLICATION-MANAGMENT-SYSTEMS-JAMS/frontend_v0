import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmt = {
  n: (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString()),
  pct: (v: number | null | undefined) => (v == null ? "—" : `${Number(v).toFixed(1)}%`),
  delta: (v: number | null | undefined) => {
    if (v == null) return "—";
    if (v === 0) return "±0%";
    return `${v > 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(1)}%`;
  },
  date: (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"),
  dateTime: (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"),
  ago: (iso?: string | null) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86_400_000);
    if (d <= 0) {
      const h = Math.floor(diff / 3_600_000);
      if (h <= 0) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
      return `${h}h ago`;
    }
    return `${d}d ago`;
  },
  days: (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}d`),
};

export const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  saved: { label: "Saved", color: "#7a736c", bg: "bg-stone-500/10", border: "border-stone-500/30" },
  applied: { label: "Applied", color: "#e2571f", bg: "bg-orange-600/12", border: "border-orange-600/35" },
  viewed: { label: "Viewed", color: "#8a6f52", bg: "bg-stone-500/12", border: "border-stone-500/35" },
  screen: { label: "Screen", color: "#b45309", bg: "bg-amber-600/12", border: "border-amber-600/35" },
  interview: { label: "Interview", color: "#c2410c", bg: "bg-orange-700/12", border: "border-orange-700/35" },
  offer: { label: "Offer", color: "#15803d", bg: "bg-emerald-600/12", border: "border-emerald-600/35" },
  rejected: { label: "Rejected", color: "#dc2626", bg: "bg-rose-600/12", border: "border-rose-600/35" },
  ghosted: { label: "Ghosted", color: "#57534e", bg: "bg-stone-600/10", border: "border-stone-600/30" },
  withdrawn: { label: "Withdrawn", color: "#a16207", bg: "bg-amber-700/10", border: "border-amber-700/30" },
};

export const BOARD_COLUMNS = ["saved", "applied", "viewed", "screen", "interview", "offer", "rejected", "ghosted"] as const;
