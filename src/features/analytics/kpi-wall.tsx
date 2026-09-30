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

type TileDef = { key: string; label: string; icon: any; tone: "mint" | "azure" | "orchid" | "amber" | "rose" | "slate" };

const TILES: TileDef[] = [
  { key: "applications", label: "Applications", icon: AppWindow, tone: "azure" },
  { key: "replies", label: "Replied via email", icon: Mail, tone: "orchid" },
  { key: "ghosted", label: "Ghosted / ignored", icon: Ghost, tone: "slate" },
  { key: "rejected", label: "Rejected", icon: XCircle, tone: "rose" },
  { key: "interviews", label: "Interviews", icon: MessagesSquare, tone: "orchid" },
  { key: "offers", label: "Offers", icon: Trophy, tone: "mint" },
  { key: "response_rate", label: "Response rate", icon: Timer, tone: "azure" },
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tiles.map((tile, i) => (
        <div key={tile.key} className="animate-stagger" style={{ ["--i" as any]: i }}>
          {isPending || !summary ? (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-9 rounded-xl" />
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
      className={cn("glass-card hairline-brand cursor-pointer overflow-hidden p-5")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tile.label}</p>
            <InfoButton title={tile.label} body={TILE_INFO[tile.key] ?? "How this number is calculated."} />
          </div>
          <p className="tnum font-display mt-2 text-[42px] font-extrabold leading-none text-foreground">
            {isStreak ? (
              <>
                {streak?.streak ?? 0} <span className="text-[22px]">🔥</span>
              </>
            ) : (
              <>
                <Odometer value={value} />
                {unit && <span className="text-[20px]">{unit}</span>}
              </>
            )}
          </p>
        </div>
        <IconChip tone={tile.tone}>
          <tile.icon className="h-5 w-5" />
        </IconChip>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {delta != null && (
          <Badge tone={up ? "mint" : "rose"} className="tnum">
            {fmt.delta(delta)}
          </Badge>
        )}
        <span className="truncate text-[11px] text-muted-foreground">{subtitle}</span>
      </div>
    </Card>
  );
}
