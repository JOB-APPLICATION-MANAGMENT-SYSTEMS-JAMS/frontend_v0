"use client";

/**
 * GoalRing / StreakMeter (§14.3) — conic-gradient progress ring driven by a CSS
 * variable (no 60fps React re-renders). States: cold · warming · burning · blazing.
 */
import * as React from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Today } from "@/types";

const STATE_STYLE: Record<string, { ring: string; flame: string; label: string }> = {
  cold: { ring: "hsl(30 8% 58%)", flame: "text-muted-foreground", label: "Cold" },
  warming: { ring: "hsl(38 92% 50%)", flame: "text-amber-500", label: "Warming" },
  burning: { ring: "hsl(24 95% 54%)", flame: "text-orange-500", label: "Burning" },
  blazing: { ring: "hsl(12 92% 52%)", flame: "text-orange-600", label: "Blazing" },
};

export function GoalRing({ today, size = 56, showLabel = false, className }: { today: Today | undefined; size?: number; showLabel?: boolean; className?: string }) {
  const pct = today?.percent ?? 0;
  const state = STATE_STYLE[today?.state ?? "cold"];
  const stroke = size >= 90 ? 8 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative grid place-items-center" style={{ width: size, height: size }} title={showLabel ? `${today?.count ?? 0}/${today?.goal ?? 20} today` : undefined}>
        <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--line))" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={state.ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
            style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.23,1,.32,1)" }}
          />
        </svg>
        {/* in-flow so it is centred by the grid on every engine (the old absolute span drifted) */}
        <span className={cn("grid place-items-center leading-none", state.flame)}>
          <Flame
            style={{ width: Math.round(size * 0.4), height: Math.round(size * 0.4) }}
            className={today?.hit ? "animate-pulse" : undefined}
          />
        </span>
      </div>
      {showLabel && (
        <div className="leading-tight">
          <p className="tnum font-display text-sm font-bold text-foreground">
            {today?.count ?? 0}/{today?.goal ?? 20}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {state.label} · {today?.streak ?? 0}🔥
          </p>
        </div>
      )}
    </div>
  );
}
