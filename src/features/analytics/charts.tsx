"use client";

/** Chart primitives (§22.3): dual-series bars+line, donut, histogram, breakdown table, sparkline. */
import * as React from "react";
import { Card, Skeleton } from "@/components/ui/base";
import { cn, fmt } from "@/lib/utils";

export function ChartCard({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass-card rounded-2xl p-4 md:p-5", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Bars (applications) + line (replies) over N periods, target line at 10% (§22.3). */
export function DualSeries({
  data,
  height = 190,
  loading,
}: {
  data: { bucket: string; applied?: number; replied?: number; count?: number }[];
  height?: number;
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">No data in this window yet — log a few applications.</p>;

  const w = 640;
  const h = height;
  const pad = { l: 30, r: 8, t: 10, b: 22 };
  const maxVal = Math.max(1, ...data.map((d) => d.applied ?? d.count ?? 0));
  const barW = Math.max(3, (w - pad.l - pad.r) / data.length - 4);
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / data.length + 2;
  const y = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - v / maxVal);
  const replyMax = Math.max(1, ...data.map((d) => d.replied ?? 0));
  const linePts = data.map((d, i) => `${x(i) + barW / 2},${pad.t + (h - pad.t - pad.b) * (1 - (d.replied ?? 0) / replyMax)}`).join(" ");

  return (
    <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[520px]">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={pad.l} x2={w - pad.r} y1={y(maxVal * g)} y2={y(maxVal * g)} stroke="hsl(var(--line))" strokeDasharray="3 4" strokeWidth="1" />
      ))}
      {data.map((d, i) => {
        const v = d.applied ?? d.count ?? 0;
        return <rect key={i} x={x(i)} y={y(v)} width={barW} height={Math.max(1, h - pad.b - y(v))} rx="3" fill="hsl(22 92% 52% / 0.85)" className="funnel-band" style={{ ["--i" as any]: Math.min(i, 8), transformOrigin: "center bottom" }} />;
      })}
      <polyline points={linePts} fill="none" stroke="hsl(40 90% 55%)" strokeWidth="2.5" strokeLinejoin="round" className="route-fade" />
      {data.map((d, i) => (
        <circle key={i} cx={x(i) + barW / 2} cy={pad.t + (h - pad.t - pad.b) * (1 - (d.replied ?? 0) / replyMax)} r="2.5" fill="hsl(40 90% 55%)" />
      ))}
      <text x={pad.l - 6} y={y(maxVal) + 4} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">{maxVal}</text>
      <text x={pad.l - 6} y={h - pad.b} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">0</text>
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

/** Response-rate donut with center % (§22.3). */
export function Donut({ segments, centerLabel, centerValue }: { segments: { label: string; value: number; color: string }[]; centerLabel: string; centerValue: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
        {segments.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={s.label} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div>
        <p className="font-display text-3xl font-extrabold">{centerValue}</p>
        <p className="text-xs text-muted-foreground">{centerLabel}</p>
        <ul className="mt-3 space-y-1.5">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
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
        {counts.map((c, i) => (
          <div key={i} className="group flex-1">
            <div className="mx-auto w-full rounded-t-md transition-all duration-500" style={{ height: `${(c / max) * 120 + 4}px`, background: labels[i]?.includes(String(threshold)) ? "hsl(355 78% 58% / .85)" : "hsl(22 92% 52% / .85)" }} title={`${labels[i]}: ${c}`} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-muted-foreground">
            {l}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        p50 <span className="tnum font-semibold text-foreground">{p50 ?? "—"}d</span> · p90{" "}
        <span className="tnum font-semibold text-foreground">{p90 ?? "—"}d</span> · ghost threshold {threshold}d
      </p>
    </div>
  );
}

/** “What's working” table with inline bars (§22.3). */
export function BreakdownTable({ items, emptyHint }: { items: { key: string; sent: number; replied: number; interviews: number; rate: number }[]; emptyHint?: string }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyHint ?? "Nothing to compare yet."}</p>;
  const maxSent = Math.max(1, ...items.map((i) => i.sent));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-3 font-semibold">Source</th>
            <th className="py-2 pr-3 font-semibold">Sent</th>
            <th className="py-2 pr-3 font-semibold">Replied</th>
            <th className="py-2 pr-3 font-semibold">Interviews</th>
            <th className="py-2 font-semibold">Reply rate</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={row.key} className="animate-stagger border-b border-border/50 last:border-0" style={{ ["--i" as any]: i }}>
              <td className="py-2.5 pr-3 font-medium capitalize">{row.key.replace("_", " ")}</td>
              <td className="tnum py-2.5 pr-3">{fmt.n(row.sent)}</td>
              <td className="tnum py-2.5 pr-3">{fmt.n(row.replied)}</td>
              <td className="tnum py-2.5 pr-3 font-semibold text-orange-700 dark:text-orange-400">{fmt.n(row.interviews)}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-[width] duration-700" style={{ width: `${(row.sent / maxSent) * 100}%` }} />
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

/** Tiny sparkline for cards. */
export function Sparkline({ values, color = "hsl(22 92% 52%)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / Math.max(1, max - min)) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
