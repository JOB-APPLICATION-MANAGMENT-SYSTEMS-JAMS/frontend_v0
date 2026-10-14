"use client";

/**
 * Chart primitives (§22.3): dual-series bars+line, donut, histogram, breakdown
 * table, sparkline.
 *
 * Everything here is hand-drawn SVG, which means the palette can be a real ramp
 * instead of a library default: bars climb the ember ladder, the reply line is a
 * lighter rung of the same hue, and the only non-ember colours on the page are
 * greys. Every series animates in on mount — bars grow from the baseline, the
 * line draws itself, the donut arcs sweep — all transform/stroke only.
 */
import * as React from "react";
import { Skeleton } from "@/components/ui/base";
import { cn, fmt } from "@/lib/utils";
import type { BreakdownRow } from "@/types";

/** Reply-rate target drawn on the timeseries chart. */
const REPLY_TARGET = 0.1;

export function ChartCard({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass-card animate-fade-in rounded-2xl p-4 sm:p-5", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="eyebrow">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      {children}
    </section>
  );
}

/** Bars (applications) + line (replies) over N periods, with the 10% reply target. */
export function DualSeries({
  data,
  height = 190,
  loading,
}: {
  data: { bucket: string; applied?: number; replied?: number; count?: number }[];
  height?: number;
  loading?: boolean;
}) {
  const uid = React.useId().replace(/:/g, "");
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">No data in this window yet, log a few applications.</p>;

  const w = 640;
  const h = height;
  const pad = { l: 30, r: 8, t: 10, b: 22 };
  const maxVal = Math.max(1, ...data.map((d) => d.applied ?? d.count ?? 0));
  const barW = Math.max(3, (w - pad.l - pad.r) / data.length - 4);
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / data.length + 2;
  const y = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - v / maxVal);
  const replyMax = Math.max(1, ...data.map((d) => d.replied ?? 0));
  const lineAt = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - v / replyMax);
  const linePts = data.map((d, i) => `${x(i) + barW / 2},${lineAt(d.replied ?? 0)}`).join(" ");
  // the same line, closed down to the baseline: one soft ember wash under the curve
  const areaPts = `${pad.l + barW / 2},${h - pad.b} ${linePts} ${x(data.length - 1) + barW / 2},${h - pad.b}`;
  // the target is a reply RATE, so it sits on the bars' scale: 10% of the tallest bar
  const targetY = y(maxVal * REPLY_TARGET);
  const showTarget = maxVal > 1;

  return (
    <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[520px]" role="img" aria-label="Applications sent with replies overlaid">
        <defs>
          <linearGradient id={`bar-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--ember))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--ember))" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--ember-soft))" stopOpacity="0.32" />
            <stop offset="100%" stopColor="hsl(var(--ember-soft))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={pad.l} x2={w - pad.r} y1={y(maxVal * g)} y2={y(maxVal * g)} stroke="hsl(var(--line))" strokeDasharray="3 4" strokeWidth="1" />
        ))}

        {showTarget && (
          <>
            <line x1={pad.l} x2={w - pad.r} y1={targetY} y2={targetY} stroke="hsl(var(--ink))" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="5 4" />
            <text x={w - pad.r} y={targetY - 3} textAnchor="end" fontSize="8" fill="hsl(var(--muted-foreground))">
              {Math.round(REPLY_TARGET * 100)}% reply target
            </text>
          </>
        )}

        {data.map((d, i) => {
          const v = d.applied ?? d.count ?? 0;
          return (
            <rect
              key={i}
              x={x(i)}
              y={y(v)}
              width={barW}
              height={Math.max(1, h - pad.b - y(v))}
              rx={Math.min(4, barW / 2)}
              fill={`url(#bar-${uid})`}
              className="chart-bar"
              style={{ "--i": Math.min(i, 14) } as React.CSSProperties}
            >
              <title>{`${d.bucket}: ${v} applied`}</title>
            </rect>
          );
        })}

        {data.length > 1 && <polygon points={areaPts} fill={`url(#area-${uid})`} className="animate-fade-in" />}
        <polyline points={linePts} fill="none" stroke="hsl(var(--ember-soft))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="chart-draw" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i) + barW / 2} cy={lineAt(d.replied ?? 0)} r="2.5" fill="hsl(30 100% 80%)">
            <title>{`${d.bucket}: ${d.replied ?? 0} replied`}</title>
          </circle>
        ))}

        <text x={pad.l - 6} y={y(maxVal) + 4} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">
          {maxVal}
        </text>
        <text x={pad.l - 6} y={h - pad.b} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">
          0
        </text>
        {data.map((d, i) =>
          data.length <= 14 || i % Math.ceil(data.length / 8) === 0 ? (
            <text key={i} x={x(i) + barW / 2} y={h - 6} textAnchor="middle" fontSize="8.5" fill="hsl(var(--muted-foreground))">
              {d.bucket.slice(5)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

/** Response-rate donut with centre % (§22.3). Arcs sweep in from the top. */
export function Donut({ segments, centerLabel, centerValue }: { segments: { label: string; value: number; color: string }[]; centerLabel: string; centerValue: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0">
        <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="hsl(var(--line))" strokeWidth="16" />
          {segments.map((s, i) => {
            const len = (s.value / total) * c;
            // pure prefix sum: the distance every previous arc already covers
            const before = segments.slice(0, i).reduce((a, p) => a + (p.value / total) * c, 0);
            return (
              <circle
                key={s.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="16"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-before}
                strokeLinecap="butt"
                className="chart-arc"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <title>{`${s.label}: ${s.value}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="hero-num text-2xl">{centerValue}</p>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{centerLabel}</p>
        <ul className="mt-2.5 space-y-1.5">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-xs transition-transform duration-[var(--dur-2)] hover:translate-x-0.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate text-muted-foreground">{s.label}</span>
              <span className="tnum ml-auto font-semibold">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Time-to-reply histogram with p50/p90 markers (§22.3). */
export function Histogram({ labels, counts, p50, p90, threshold }: { labels: string[]; counts: number[]; p50: number | null; p90: number | null; threshold: number }) {
  const max = Math.max(1, ...counts);
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5">
        {counts.map((c, i) => {
          const ghostBucket = labels[i]?.includes(String(threshold));
          return (
            <div key={i} className="group flex-1">
              <div
                className="chart-bar mx-auto w-full rounded-t-md transition-[filter] duration-[var(--dur-2)] hover:brightness-110"
                style={{
                  height: `${(c / max) * 120 + 4}px`,
                  background: ghostBucket ? "repeating-linear-gradient(135deg, hsl(var(--ink) / .55) 0 4px, hsl(var(--ink) / .2) 4px 8px)" : "linear-gradient(180deg, hsl(var(--ember)), hsl(var(--ember) / .6))",
                  "--i": Math.min(i, 12),
                } as React.CSSProperties}
                title={`${labels[i]}: ${c}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-muted-foreground">
            {l}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        p50 <span className="tnum font-semibold text-foreground">{p50 ?? "n/a"}d</span> · p90 <span className="tnum font-semibold text-foreground">{p90 ?? "n/a"}d</span> · ghost threshold {threshold}d
      </p>
    </div>
  );
}

/** “What's working” table with inline bars (§22.3). */
export function BreakdownTable({ items, emptyHint }: { items: BreakdownRow[]; emptyHint?: string }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyHint ?? "Nothing to compare yet."}</p>;
  const maxSent = Math.max(1, ...items.map((i) => i.sent));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {["Source", "Sent", "Replied", "Interviews", "Reply rate"].map((h) => (
              <th key={h} className="eyebrow py-2 pr-3 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={row.key} className="animate-stagger border-b border-border/60 transition-colors duration-[var(--dur-2)] last:border-0 hover:bg-ember/6" style={{ "--i": i } as React.CSSProperties}>
              <td className="py-2.5 pr-3 font-medium capitalize">{row.key.replace("_", " ")}</td>
              <td className="tnum py-2.5 pr-3">{fmt.n(row.sent)}</td>
              <td className="tnum py-2.5 pr-3">{fmt.n(row.replied)}</td>
              <td className="tnum py-2.5 pr-3 font-semibold text-ember-deep dark:text-ember-soft">{fmt.n(row.interviews)}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-[width] duration-700 ease-[var(--ease-out)]" style={{ width: `${(row.sent / maxSent) * 100}%` }} />
                  </div>
                  <span className="tnum text-xs font-semibold">{fmt.pct(row.rate)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tiny sparkline for cards: ember stroke over a soft wash. */
export function Sparkline({ values, color = "hsl(30 100% 60%)" }: { values: number[]; color?: string }) {
  const uid = React.useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / Math.max(1, max - min)) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,32 ${pts} 100,32`} fill={`url(#spark-${uid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
