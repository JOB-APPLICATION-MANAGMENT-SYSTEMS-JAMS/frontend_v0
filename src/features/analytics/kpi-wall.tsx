"use client";

/** KPI wall (§22.1) — skeletons mirror the grid, every stat has icon + label + bold number, deltas vs previous period. */
import * as React from "react";
import { AppWindow, Mail, Ghost, XCircle, MessagesSquare, Trophy, Flame, Timer } from "lucide-react";
import { Card, Skeleton, IconChip, Badge } from "@/components/ui/base";
import { ErrorState } from "@/components/ui/feedback";
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

export function KpiWall({
  summary,
  isPending,
  error,
  onRetry,
  onDrill,
}: {
  summary?: Summary;
  isPending: boolean;
  error: unknown;
  onRetry?: () => void;
  onDrill?: (key: string) => void;
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {TILES.map((tile, i) => (
        <div key={tile.key} className="animate-stagger" style={{ ["--i" as any]: i }}>
          {isPending || !summary ? (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-xl" />
              </div>
              <Skeleton className="mt-4 h-9 w-28" />
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
      className={cn("glass-card glass-hover hairline-brand cursor-pointer overflow-hidden p-4 transition-transform")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tile.label}</p>
          <p className="tnum font-display mt-1.5 text-[34px] font-extrabold leading-none text-foreground">
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
          <tile.icon className="h-4.5 w-4.5" />
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
