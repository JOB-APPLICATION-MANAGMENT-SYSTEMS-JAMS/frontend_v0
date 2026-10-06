"use client";

/**
 * Funnel field (§22.2), the diagrammatic hero: layered horizontal bands with hand-drawn
 * wavy top edges, width ∝ count (min 8% so tiny statuses stay visible), giant right-aligned
 * counters, Funnel Bloom on mount (spec 6), hover lift + drill-down.
 */
import * as React from "react";
import { cn, fmt } from "@/lib/utils";
import { InfoButton } from "@/components/ui/modal";
import type { Summary } from "@/types";

type Band = { key: string; label: string; from: string; to: string; text: string };

const BANDS: Band[] = [
  { key: "applied", label: "Applications", from: "#ff7a1a", to: "#ffa257", text: "#241103" },
  { key: "ghosted", label: "Ghosted / no reply", from: "#57524d", to: "#948d86", text: "#14110f" },
  { key: "rejected", label: "Rejected", from: "#a33f2b", to: "#d9705a", text: "#fff" },
  { key: "replied", label: "Replied", from: "#f0a012", to: "#ffd073", text: "#2a1c00" },
  { key: "interview", label: "1st Interview", from: "#7d6a4e", to: "#b8a077", text: "#191409" },
  { key: "offer", label: "Offers 🎉", from: "#efe6da", to: "#ffffff", text: "#1a1613" },
];

function wavePath(y0: number, h: number, w: number, amp = 6) {
  const q = w / 4;
  return `M0 ${y0} Q ${q / 2} ${y0 - amp} ${q} ${y0} T ${2 * q} ${y0} T ${3 * q} ${y0} T ${w} ${y0}
          L ${w} ${y0 + h} Q ${3 * q + q / 2} ${y0 + h + amp} ${3 * q} ${y0 + h} T ${q} ${y0 + h} T 0 ${y0 + h} Z`;
}

export function FunnelField({
  summary,
  period,
  onPeriodChange,
  onDrill,
  className,
}: {
  summary?: Summary;
  period: string;
  onPeriodChange?: (p: string) => void;
  onDrill?: (key: string) => void;
  className?: string;
}) {
  const counts = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of summary?.funnel ?? []) map[f.key] = f.count;
    return map;
  }, [summary]);

  const max = Math.max(1, ...Object.values(counts));
  const reachedHuman = counts.applied ? Math.round(((counts.replied ?? 0) / counts.applied) * 1000) / 10 : 0;
  const rowH = 54;
  const gap = 10;
  const height = BANDS.length * (rowH + gap) + 30;

  return (
    <section className={cn("glass-card rounded-2xl p-4 md:p-5", className)}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
        <div className="flex items-center gap-1.5">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Funnel</h3>
          <InfoButton
            title="Funnel"
            body={
              <>
                <p>Each band is one stage of your pipeline this {period}, drawn with width proportional to how many applications reached that stage.</p>
                <p>
                  <b>Reached a human</b> is replies divided by applications sent in the same window, so it never passes 100%. Click a band to open the tracker filtered to that stage.
                </p>
              </>
            }
          />
        </div>
          <p className="text-[11px] text-muted-foreground">
            {period.toUpperCase()} · <span className="font-semibold text-foreground">{reachedHuman}%</span> reached a human
          </p>
        </div>
        {onPeriodChange && (
          <div className="glass-tab flex rounded-full p-0.5">
            {["day", "week", "month", "year"].map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
                  p === period ? "bg-[image:var(--gradient-brand)] text-white" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </header>

      {!summary ? (
        <div className="space-y-3">
          {BANDS.map((b) => (
            <div key={b.key} className="skeleton h-12 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
          <svg viewBox={`0 0 720 ${height}`} className="w-full min-w-[560px]" role="img" aria-label="Application funnel">
          <defs>
            {BANDS.map((b) => (
              <linearGradient key={b.key} id={`fg-${b.key}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={b.from} />
                <stop offset="100%" stopColor={b.to} />
              </linearGradient>
            ))}
          </defs>
          {BANDS.map((b, i) => {
            const count = counts[b.key] ?? 0;
            const w = Math.max(96, (count / max) * 700);
            const y = 16 + i * (rowH + gap);
            return (
              <g
                key={b.key}
                className="funnel-band cursor-pointer"
                style={{ "--i": i } as React.CSSProperties}
                onClick={() => onDrill?.(b.key)}
                role="button"
                tabIndex={0}
              >
                <path d={wavePath(y, rowH, w)} fill={`url(#fg-${b.key})`} opacity="0.94" />
                <text x="16" y={y + 26} fill={b.text} fontSize="13" fontWeight="700" fontFamily="ui-monospace, monospace">
                  {b.label}
                </text>
                <text x="16" y={y + 43} fill={b.text} fontSize="10" opacity="0.85" fontFamily="ui-monospace, monospace">
                  {counts.applied ? `${Math.round((count / counts.applied) * 1000) / 10}% of applied` : ""}
                </text>
                <text
                  x={Math.min(w - 14, 706)}
                  y={y + 38}
                  textAnchor="end"
                  fill={b.text}
                  fontSize="26"
                  fontWeight="800"
                  fontFamily="ui-monospace, monospace"
                >
                  {fmt.n(count)}
                </text>
                <title>{`${b.label}: ${count}, click to filter`}</title>
              </g>
            );
          })}
          </svg>
        </div>
      )}
    </section>
  );
}
