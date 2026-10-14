"use client";

/** KPI wall (§22.1), skeletons mirror the grid, every stat has icon + label + bold number, deltas vs previous period. */
import * as React from "react";
import { AppWindow, Mail, Ghost, XCircle, MessagesSquare, Trophy, Flame, Timer } from "lucide-react";
import { Card, Skeleton, IconChip, Badge } from "@/components/ui/base";
import { ErrorState } from "@/components/ui/feedback";
import { InfoButton } from "@/components/ui/modal";
import { Odometer } from "@/components/motion/odometer";
import { fmt, cn } from "@/lib/utils";
import type { Kpi, Summary, Today } from "@/types";

type TileDef = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; tone: "mint" | "azure" | "orchid" | "amber" | "rose" | "slate" };

/* Read the wall as a funnel, not a rainbow: the two warm rungs go to the numbers
   that mean progress, the grey rung to the one that means "nothing happened",
   and the hue-free ink rung to rejection. */
const TILES: TileDef[] = [
  { key: "applications", label: "Applications", icon: AppWindow, tone: "azure" },
  { key: "replies", label: "Replied via email", icon: Mail, tone: "orchid" },
  { key: "ghosted", label: "Ghosted / ignored", icon: Ghost, tone: "slate" },
  { key: "rejected", label: "Rejected", icon: XCircle, tone: "rose" },
  { key: "interviews", label: "Interviews", icon: MessagesSquare, tone: "orchid" },
  { key: "offers", label: "Offers", icon: Trophy, tone: "mint" },
  { key: "response_rate", label: "Response rate", icon: Timer, tone: "amber" },
  { key: "streak", label: "Current streak", icon: Flame, tone: "amber" },
];

/** Plain-language explanations behind each tile's (i) icon. */
const TILE_INFO: Record<string, string> = {
  applications:
    "Applications means everything you sent in the selected window: both real applications to a posting and pitches (cold outreach where no posting exists). Each one counts on the day it was sent.",
  replies:
    "Replies counts applications where a response arrived by email in the window, tracked from your connected mailbox or logged manually. Only the first reply per application counts.",
  ghosted:
    "Ghosted means an application with no reply for 14 days or more past the threshold. It is not a rejection; it is a signal to follow up, move on, or try another channel.",
  rejected:
    "Rejected counts applications where the employer said no. It is separate from ghosted so silence and explicit rejection never get lumped together.",
  interviews:
    "Interviews counts applications you moved into the interview stage in this window. Offers and rejections after an interview stay in their own tiles.",
  offers: "Offers counts applications that reached the offer stage. Reaching one flips the Victory flow so you can close the loop and start your streak celebration.",
  response_rate:
    "Response rate is cohort-based: of the applications you SENT in this window, the share that has ever been answered. Replies to older applications are not mixed in, so it can never pass 100%.",
  streak:
    "Current streak is consecutive days you hit your daily application goal. Missing a day breaks the streak unless a freeze covers it; any-effort streaks count days with at least one log.",
};

export function KpiWall({
  summary,
  isPending,
  error,
  onRetry,
  onDrill,
  keys,
}: {
  summary?: Summary;
  isPending: boolean;
  error: unknown;
  onRetry?: () => void;
  onDrill?: (key: string) => void;
  /** restrict to a subset of tile keys (dashboard shows the first four; analytics shows all) */
  keys?: string[];
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  const tiles = keys ? TILES.filter((t) => keys.includes(t.key)) : TILES;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {tiles.map((tile, i) => (
        <div key={tile.key} className="animate-stagger" style={{ "--i": i } as React.CSSProperties}>
          {isPending || !summary ? (
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
              </div>
              <Skeleton className="mt-4 h-10 w-28" />
              <Skeleton className="mt-3 h-4 w-36" />
            </Card>
          ) : (
            <StatTile tile={tile} summary={summary} onClick={onDrill} />
          )}
        </div>
      ))}
    </div>
  );
}

function StatTile({ tile, summary, onClick }: { tile: TileDef; summary: Summary; onClick?: (k: string) => void }) {
  const streak = summary.kpis.streak as Today;
  const isStreak = tile.key === "streak";
  const kpi = summary.kpis[tile.key] as Kpi | undefined;

  const value = isStreak ? streak?.streak ?? 0 : kpi?.value ?? 0;
  const delta = isStreak ? null : kpi?.delta_pct ?? null;
  const unit = isStreak ? "" : (kpi?.unit ?? "");
  const up = (delta ?? 0) >= 0;

  const subtitle = isStreak
    ? `goal ${streak?.goal ?? 20}/day · done today ${streak?.count ?? 0}`
    : delta == null
      ? "no previous period"
      : `${fmt.delta(delta)} vs previous ${summary.period}`;

  return (
    <Card
      onClick={() => onClick?.(tile.key)}
      interactive
      className={cn("glass-card hairline-brand group overflow-hidden p-4 sm:p-5")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <p className="text-[10px] font-semibold uppercase leading-tight tracking-wider text-muted-foreground sm:text-[11px]">{tile.label}</p>
            <InfoButton title={tile.label} body={TILE_INFO[tile.key] ?? "How this number is calculated."} />
          </div>
          {/* phones drop the wall to two columns: scale the hero number so 5-digit
              counts still fit a ~100px content box */}              <p className="tnum hero-num mt-1.5 text-[28px] text-foreground sm:mt-2 sm:text-4xl lg:text-[42px]">
            {isStreak ? (
              <>
                {streak?.streak ?? 0} <span className="text-[18px] sm:text-[22px]">🔥</span>
              </>
            ) : (
              <>
                <Odometer value={value} />
                {unit && <span className="text-[16px] sm:text-[20px]">{unit}</span>}
              </>
            )}
          </p>
        </div>
        <span className="transition-transform duration-[var(--dur-3)] ease-[var(--ease-spring)] group-hover:-translate-y-0.5 group-hover:scale-105">
          <IconChip tone={tile.tone}>
            <tile.icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </IconChip>
        </span>
      </div>
      <div className="mt-2.5 flex flex-col items-start gap-1 sm:mt-3 sm:flex-row sm:items-center sm:gap-2">
        {delta != null && (
          <Badge tone={up ? "mint" : "rose"} className="tnum">
            {fmt.delta(delta)}
          </Badge>
        )}
        <span className="w-full truncate text-[11px] text-muted-foreground">{subtitle}</span>
      </div>
    </Card>
  );
}
