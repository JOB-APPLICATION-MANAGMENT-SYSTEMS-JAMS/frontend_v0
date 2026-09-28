"use client";

/** Analytics (§22): global period toggle, KPI wall, funnel, timeseries, breakdowns, distributions, export. */
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Download, FileJson } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { Summary } from "@/types";
import { KpiWall } from "@/features/analytics/kpi-wall";
import { FunnelField } from "@/features/analytics/funnel-field";
import { Heatmap } from "@/features/analytics/heatmap";
import { BreakdownTable, ChartCard, Donut, DualSeries, Histogram } from "@/features/analytics/charts";
import { Button, Card, Select, Skeleton } from "@/components/ui/base";
import { toast } from "@/hooks/use-toast";

const PERIODS = ["day", "week", "month", "year"] as const;

export default function AnalyticsPage() {
  return (
    <React.Suspense fallback={null}>
      <AnalyticsPageInner />
    </React.Suspense>
  );
}

function AnalyticsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const period = (params.get("period") ?? "week") as (typeof PERIODS)[number];
  const [breakdownBy, setBreakdownBy] = React.useState<"source" | "company" | "cv" | "template" | "category">("source");

  const summary = useQuery<Summary>({ queryKey: qk.summary(period), queryFn: () => appFetch("/analytics/summary", { params: { period }, _auth: true }) });
  const series = useQuery({ queryKey: ["analytics", "timeseries", period], queryFn: () => appFetch<{ items: any[] }>("/analytics/timeseries", { params: { metric: "applied", bucket: period === "year" ? "month" : period === "month" ? "week" : "day" }, _auth: true }) });
  const replies = useQuery({ queryKey: ["analytics", "timeseries", period, "replied"], queryFn: () => appFetch<{ items: any[] }>("/analytics/timeseries", { params: { metric: "replied", bucket: period === "year" ? "month" : period === "month" ? "week" : "day" }, _auth: true }) });
  const heatmap = useQuery({ queryKey: ["analytics", "heatmap"], queryFn: () => appFetch<{ year: number; days: any[] }>("/analytics/heatmap", { _auth: true }) });
  const breakdown = useQuery({ queryKey: ["analytics", "breakdown", breakdownBy], queryFn: () => appFetch<{ items: any[] }>("/analytics/breakdown", { params: { by: breakdownBy }, _auth: true }) });
  const ttr = useQuery<{ labels: string[]; counts: number[]; p50: number | null; p90: number | null; ghost_threshold: number }>({
    queryKey: ["analytics", "time-to-reply"],
    queryFn: () => appFetch("/analytics/time-to-reply", { _auth: true }),
  });

  const funnel = React.useMemo(() => {
    const items = summary.data?.funnel ?? [];
    const replied = items.find((f) => f.key === "replied")?.count ?? 0;
    const applied = Math.max(1, items.find((f) => f.key === "applied")?.count ?? 1);
    const interviews = items.find((f) => f.key === "interview")?.count ?? 0;
    const offers = items.find((f) => f.key === "offer")?.count ?? 0;
    return {
      segments: [
        { label: "Replied", value: replied, color: "hsl(22 92% 52%)" },
        { label: "No reply", value: Math.max(0, applied - replied), color: "hsl(30 10% 82%)" },
      ],
      replyRate: (replied / applied) * 100,
      interviews,
      offers,
    };
  }, [summary.data]);

  const download = async (format: "json" | "csv") => {
    try {
      const data = await appFetch(`/export`, { params: { format }, _auth: true });
      const text = format === "csv" ? String(data) : JSON.stringify(data, null, 2);
      const blob = new Blob([text], { type: format === "csv" ? "text/csv" : "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "csv" ? "jams-applications.csv" : "jams-export.json";
      a.click();
      URL.revokeObjectURL(url);
      toast("Export downloaded — lock-in is immoral (§31)", "success");
    } catch {
      toast("Export failed", "error");
    }
  };

  const setPeriod = (p: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("period", p);
    router.replace(`/analytics?${sp.toString()}`, { scroll: false });
  };

  // merge applied + replied series for the dual chart
  const merged = (series.data?.items ?? []).map((d) => ({
    bucket: d.bucket,
    applied: d.count ?? d.applied ?? 0,
    replied: (replies.data?.items ?? []).find((r) => r.bucket === d.bucket)?.count ?? 0,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Honest numbers, comparison against the previous window (§22).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-border bg-muted/60 p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${period === p ? "bg-white text-foreground shadow dark:bg-white/15" : "text-muted-foreground hover:text-foreground"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => download("csv")}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => download("json")}>
            <FileJson className="h-3.5 w-3.5" /> JSON
          </Button>
        </div>
      </header>

      <KpiWall summary={summary.data} isPending={summary.isPending} error={summary.error} onRetry={() => summary.refetch()} onDrill={(k) => router.push(`/tracker?status=${k}`)} />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <ChartCard title="Applied vs replied" subtitle={`${period} window · bars = applied, line = replied`}>
          {series.isPending ? <Skeleton className="h-48 w-full" /> : <DualSeries data={merged} />}
        </ChartCard>

        <ChartCard title="Response mix" subtitle="replied vs silent · interview & offer tallies">
          {summary.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <Donut segments={funnel.segments} centerLabel="reply rate" centerValue={`${funnel.replyRate.toFixed(1)}%`} />
              <div className="space-y-3">
                <div>
                  <p className="tnum font-display text-2xl font-extrabold text-foreground">{funnel.interviews}</p>
                  <p className="text-xs text-muted-foreground">interviews</p>
                </div>
                <div>
                  <p className="tnum font-display text-2xl font-extrabold text-foreground">{funnel.offers}</p>
                  <p className="text-xs text-muted-foreground">offers</p>
                </div>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <FunnelField summary={summary.data} period={period} onPeriodChange={setPeriod} onDrill={(key) => router.push(`/tracker?status=${key}`)} />

        <ChartCard
          title="What's working"
          subtitle={`broken down by ${breakdownBy}`}
          action={
            <Select className="h-8 w-36 text-xs" value={breakdownBy} onChange={(e) => setBreakdownBy(e.target.value as any)}>
              <option value="source">source</option>
              <option value="company">company</option>
              <option value="cv">CV</option>
              <option value="template">template</option>
              <option value="category">category</option>
            </Select>
          }
        >
          {breakdown.isPending ? <Skeleton className="h-40 w-full" /> : <BreakdownTable items={breakdown.data?.items ?? []} />}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Time to first reply" subtitle="distribution against the ghost threshold">
          {ttr.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Histogram labels={ttr.data!.labels} counts={ttr.data!.counts} p50={ttr.data!.p50} p90={ttr.data!.p90} threshold={ttr.data!.ghost_threshold} />
          )}
        </ChartCard>

        <Heatmap days={heatmap.data?.days} year={heatmap.data?.year ?? new Date().getFullYear()} onPick={() => router.push("/streaks")} />
      </div>

      <Card className="p-4">
        <p className="text-xs text-muted-foreground">
          Export includes every table you own — profile, applications, events, CVs, templates, companies, outreach, streaks. No lock-in (§31).
        </p>
      </Card>
    </div>
  );
}
