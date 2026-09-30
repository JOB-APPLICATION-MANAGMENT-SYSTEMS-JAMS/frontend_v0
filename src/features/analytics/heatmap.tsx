"use client";

/** Heatmap calendar (§22.3), 52×7 GitHub-style grid, diagonal ripple cascade, today's breathing ring. */
import * as React from "react";
import { cn } from "@/lib/utils";
import { InfoButton } from "@/components/ui/modal";

type Day = { day: string; count: number; goal: number; hit: boolean; streak: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Heatmap({ days, year, onPick, className }: { days?: Day[]; year: number; onPick?: (day: string) => void; className?: string }) {
  const todayStr = new Date().toLocaleDateString("en-CA");
  const cells = React.useMemo(() => buildYear(year, days ?? []), [year, days]);

  return (
    <section className={cn("glass-card rounded-2xl p-4 md:p-5", className)}>
      <header className="mb-3 flex items-center justify-between">
        <div>
        <div className="flex items-center gap-1.5">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Consistency</h3>
          <InfoButton
            title="Consistency heatmap"
            body={
              <>
                <p>A GitHub-style grid of {year}: one square per day, darker orange means more applications logged that day.</p>
                <p>Days where you hit your daily goal get the boldest shade, and the ring marks today. Click any day to jump to your streaks.</p>
              </>
            }
          />
        </div>
          <p className="text-[11px] text-muted-foreground">{year} · intensity = applications per day</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="h-3 w-3 rounded-[3px]" style={{ background: intensity(l / 4) }} />
          ))}
          <span>more</span>
        </div>
      </header>

      <div className="overflow-x-auto no-scrollbar">
        <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ width: "max-content" }}>
          {cells.map((c, idx) => {
            const col = Math.floor(idx / 7);
            const pct = c ? Math.min(1, c.count / Math.max(1, c.goal)) : 0;
            const isToday = c?.day === todayStr;
            return (
              <div
                key={c?.day ?? `x-${idx}`}
                className={cn("heat-cell h-3.5 w-3.5 cursor-pointer rounded-[4px] transition-transform hover:scale-125", isToday && "today-ring")}
                style={{
                  background: c ? intensity(pct) : "hsl(var(--line) / 0.4)",
                  ["--c" as any]: col,
                }}
                title={c ? `${c.day}: ${c.count}/${c.goal}${c.hit ? " · goal hit 🎯" : ""}` : ""}
                onClick={() => c && onPick?.(c.day)}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-between px-0.5 text-[10px] text-muted-foreground" style={{ width: "max-content", minWidth: "100%" }}>
        {MONTHS.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </section>
  );
}

function intensity(p: number) {
  if (p <= 0) return "hsl(var(--line) / 0.45)";
  if (p < 0.25) return "hsl(var(--ember) / 0.25)";
  if (p < 0.5) return "hsl(var(--ember) / 0.45)";
  if (p < 0.75) return "hsl(var(--ember) / 0.7)";
  if (p < 1) return "hsl(var(--ember) / 0.9)";
  return "hsl(var(--gold) / 0.95)"; // goal day reads white-hot
}

function buildYear(year: number, days: Day[]): (Day | null)[] {
  const map = new Map(days.map((d) => [d.day, d]));
  const out: (Day | null)[] = [];
  const start = new Date(`${year}-01-01T00:00:00Z`);
  const end = new Date(`${year}-12-31T00:00:00Z`);
  const startDow = (start.getUTCDay() + 6) % 7; // Monday-first
  for (let i = 0; i < startDow; i++) out.push(null);
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const key = new Date(t).toISOString().slice(0, 10);
    out.push(map.get(key) ?? { day: key, count: 0, goal: 20, hit: false, streak: 0 });
  }
  while (out.length % 7 !== 0) out.push(null);
  return out;
}
