"use client";

/**
 * The app's view of the contribution skyline.
 *
 * Two jobs only: turn `/analytics/heatmap` rows (`{ day, count, goal, hit, streak }`)
 * into the skyline's `{ date, count }`, and dress it in the product's glass. The
 * chart itself is a primitive (`components/ui/contribution-skyline`), so nothing
 * here knows about projection, palettes or the morph.
 *
 * The component draws its own surface, so the glass is a frame around a translucent
 * panel rather than a class on the section: `!bg-card/60` has to beat the inline
 * background it sets, and a totally transparent panel would leave the canvas
 * floating on the mesh with no readable contrast.
 */
import * as React from "react";
import ContributionSkyline, { type ContributionDay, type PaletteInput } from "@/components/ui/contribution-skyline";
import type { HeatmapDay } from "@/types";

export function ConsistencyCard({
  days,
  year,
  unit = "application",
  palette = "ember",
  onPick,
  className,
}: {
  days?: HeatmapDay[];
  year?: number;
  /** Singular noun for one logged item. */
  unit?: string;
  palette?: PaletteInput;
  /** Called with the `YYYY-MM-DD` of a chosen day. */
  onPick?: (day: string) => void;
  className?: string;
}) {
  const data = React.useMemo<ContributionDay[] | undefined>(() => {
    const rows = days?.filter((d) => !!d?.day);
    if (rows?.length) return rows.map((d) => ({ date: d.day, count: d.count ?? 0 }));
    // An empty payload is not an empty *chart*. Without this the primitive draws
    // its generated sample year, and a new account would be shown a year of
    // activity it never had. With a year to draw, the grid is real and flat.
    if (!year) return undefined;
    const out: ContributionDay[] = [];
    for (let ms = Date.UTC(year, 0, 1); new Date(ms).getUTCFullYear() === year; ms += 86400000) {
      out.push({ date: new Date(ms).toISOString().slice(0, 10), count: 0 });
    }
    return out;
  }, [days, year]);

  // Only ever undefined when there is no year to draw at all.
  const endDate = data ? undefined : year ? `${year}-12-31` : undefined;

  return (
    <div className={className ? `glass-card rounded-2xl p-1.5 ${className}` : "glass-card rounded-2xl p-1.5"}>
      <ContributionSkyline
        data={data}
        endDate={data ? undefined : endDate}
        palette={palette}
        unit={unit}
        weekStart={1}
        onCellClick={(d) => onPick?.(d.date)}
        className="!border-transparent !bg-card/60 rounded-2xl"
      />
    </div>
  );
}
