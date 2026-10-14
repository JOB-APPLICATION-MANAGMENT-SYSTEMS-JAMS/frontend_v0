"use client";

/**
 * Funnel field (§22.2), the diagrammatic hero: layered horizontal bands with hand-drawn
 * wavy top edges, width ∝ count (min 8% so tiny statuses stay visible), giant right-aligned
 * counters, Funnel Bloom on mount (spec 6), hover lift + drill-down.
 */
import * as React from "react";
import { cn, fmt } from "@/lib/utils";
import { InfoButton } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/layout";
import type { Summary } from "@/types";

type Band = { key: string; label: string; from: string; to: string; text: string };

/*
 * The funnel is a temperature chart, not a palette test.
 *
 * Progressing stages climb the ember ladder from mid to full; the two dead ends
 * (ghosted, rejected) fall out of the hue entirely into grey and ink, which is
 * what makes them read as "stopped" rather than as another step. Every band is
 * OPAQUE with a fixed text colour, so the diagram is legible on white and on
 * black without a single theme-specific value.
 */
const BANDS: Band[] = [
  { key: "applied", label: "Applications", from: "hsl(30 100% 56%)", to: "hsl(30 100% 70%)", text: "#1a1005" },
  { key: "ghosted", label: "Ghosted / no reply", from: "hsl(0 0% 38%)", to: "hsl(0 0% 52%)", text: "#ffffff" },
  { key: "rejected", label: "Rejected", from: "hsl(0 0% 14%)", to: "hsl(0 0% 28%)", text: "#ffffff" },
  { key: "replied", label: "Replied", from: "hsl(30 100% 44%)", to: "hsl(30 100% 58%)", text: "#1a1005" },
  { key: "interview", label: "1st Interview", from: "hsl(30 100% 28%)", to: "hsl(30 100% 40%)", text: "#ffffff" },
  { key: "offer", label: "Offers 🎉", from: "hsl(30 100% 92%)", to: "hsl(30 100% 76%)", text: "#1a1005" },
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
          <h3 className="eyebrow">Funnel</h3>
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
          <SegmentedControl
            ariaLabel="Funnel period"
            size="sm"
            value={period}
            onChange={onPeriodChange}
            options={[
              { value: "day", label: "day" },
              { value: "week", label: "week" },
              { value: "month", label: "month" },
              { value: "year", label: "year" },
            ]}
          />
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
            // min width must fit the longest label + its counter, otherwise tiny
            // stages render as a sliver with their text spilling onto the page
            const w = Math.max(250, (count / max) * 700);
            const y = 16 + i * (rowH + gap);
            return (
              <g
                key={b.key}
                className="funnel-band cursor-pointer transition-[filter] duration-[var(--dur-2)] hover:brightness-[1.08]"
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
