"use client";

/** Dashboard (§22): KPI wall + funnel field + heatmap + ghost alerts + “continue applying”. */
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, Ghost, Sparkles } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { Application, Paged, Summary } from "@/types";
import { KpiWall } from "@/features/analytics/kpi-wall";
import { FunnelField } from "@/features/analytics/funnel-field";
import { Heatmap } from "@/features/analytics/heatmap";
import { ChartCard, BreakdownTable, DualSeries } from "@/features/analytics/charts";
import { Card, Button, Badge, Skeleton } from "@/components/ui/base";
import { EmptyState, InlineBanner } from "@/components/ui/feedback";
import { InfoButton } from "@/components/ui/modal";
import { fireConfetti } from "@/lib/confetti";
import { fmt } from "@/lib/utils";

export default function DashboardPage() {
  return (
    <React.Suspense fallback={null}>
      <DashboardPageInner />
    </React.Suspense>
  );
}

function DashboardPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const period = params.get("period") ?? "week";
  const celebrated = React.useRef(false);

  const summary = useQuery<Summary>({
    queryKey: qk.summary(period),
    queryFn: () => appFetch("/analytics/summary", { params: { period }, _auth: true }),
  });

  const heatmap = useQuery<{ year: number; days: any[] }>({
    queryKey: ["analytics", "heatmap"],
    queryFn: () => appFetch("/analytics/heatmap", { _auth: true }),
  });

  const series = useQuery({
    queryKey: ["analytics", "timeseries", period],
    queryFn: () => appFetch<{ items: any[] }>("/analytics/timeseries", { params: { metric: "applied", bucket: period === "day" ? "day" : period === "week" ? "day" : "week" }, _auth: true }),
  });

  const ghosts = useQuery<Paged<Application>>({
    queryKey: qk.applicationList({ status: "ghosted", page_size: 5 }),
    queryFn: () => appFetch("/applications", { params: { status: "ghosted", page_size: 5 }, _auth: true }),
  });

  const breakdown = useQuery({
    queryKey: ["analytics", "breakdown", "source"],
    queryFn: () => appFetch<{ items: any[] }>("/analytics/breakdown", { params: { by: "source" }, _auth: true }),
  });

  const streak = summary.data?.kpis.streak;

  // goal hit → confetti once per mount (§23.1)
  React.useEffect(() => {
    if (streak?.hit && !celebrated.current) {
      celebrated.current = true;
      fireConfetti();
    }
  }, [streak?.hit]);

  return (
    <div className="space-y-6">
      {/* hero strip */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Today</p>
            <InfoButton
              title="Today"
              body={
                <>
                  <p>Your daily target for this day in your timezone: as many applications logged as your goal allows.</p>
                  <p>Hitting it keeps your streak alive and triggers a small celebration. Goal and timezone are editable from Settings.</p>
                </>
              }
            />
          </div>
          <h2 className="font-display text-2xl font-extrabold">
            {streak?.hit ? (
              <>
                Goal smashed <span className="text-gradient-brand">{streak.count}/{streak.goal}</span> 🎯
              </>
            ) : streak ? (
              <>
                <span className="tnum text-gradient-brand">{streak.count}/{streak.goal}</span> applications, {streak.remaining} to go
              </>
            ) : (
              "Loading your day…"
            )}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="azure" onClick={() => router.push("/discover")}>
            <Compass className="h-4 w-4" /> Find roles
          </Button>
          <Button variant="outline" onClick={() => router.push("/capture?new=1")}>
            <Sparkles className="h-4 w-4" /> Quick capture
          </Button>
          {/* celebration entry point, kept reachable now that the rail is seven items */}
          <Button variant="ghost" onClick={() => router.push("/victory")}>
            🎉 I got a job
          </Button>
        </div>
      </Card>

      {/* KPI wall: dashboard shows the first four tiles; all eight live on the analytics page */}
      <KpiWall summary={summary.data} isPending={summary.isPending} error={summary.error} onRetry={() => summary.refetch()} onDrill={(key) => router.push(`/analytics?focus=${key}`)} keys={["applications", "replies", "ghosted", "rejected"]} />

      {/* funnel + heatmap */}
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <FunnelField summary={summary.data} period={period} onPeriodChange={(p) => router.replace(`/dashboard?period=${p}`)} onDrill={(key) => router.push(`/tracker?status=${key}`)} />
        <div className="space-y-6">
          <ChartCard
            title="Applied vs replied"
            subtitle={`${period} buckets · line = replies`}
            action={<InfoButton title="Applied vs replied" body="One bar per bucket for applications you sent, with a line tracking how many of them ever got answered. Buckets follow the period toggle above the funnel." />}
          >
            {series.isPending ? <Skeleton className="h-44 w-full" /> : <DualSeries data={series.data?.items ?? []} />}
          </ChartCard>
          <ChartCard
            title="What's working"
            subtitle="by source"
            action={
              <InfoButton
                title="What's working"
                body={
                  <>
                    <p>Your applications broken down by where they came from: job boards, direct company sites, referrals, searches and manual logs.</p>
                    <p>Compare reply behaviour per source to see which channel actually deserves your time.</p>
                  </>
                }
              />
            }
          >
            {breakdown.isPending ? <Skeleton className="h-32 w-full" /> : <BreakdownTable items={(breakdown.data?.items ?? []).slice(0, 5)} />}
          </ChartCard>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Heatmap days={heatmap.data?.days} year={heatmap.data?.year ?? new Date().getFullYear()} onPick={() => router.push("/streaks")} />

        <ChartCard
          title="Ghost alerts"
          subtitle="applications with no reply beyond the threshold"
          action={
            <div className="flex items-center gap-2">
              <InfoButton
                title="Ghost alerts"
                body={
                  <>
                    <p>Applications with no reply beyond your ghost threshold (14 days by default) flip to Ghosted automatically.</p>
                    <p>They are here so you can follow up once more, mark them rejected, or let them age out of your pipeline.</p>
                  </>
                }
              />
              <Button size="sm" variant="ghost" onClick={() => router.push("/tracker?status=ghosted")}>
                Open tracker <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          }
        >
          {ghosts.isPending ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (ghosts.data?.items?.length ?? 0) === 0 ? (
            <EmptyState title="No ghosts (yet)" description="Applications with no reply for 14+ days flip to Ghosted automatically." />
          ) : (
            <ul className="space-y-2">
              {ghosts.data!.items.map((a, i) => (
                <li key={a.id} className="animate-stagger flex items-center gap-3 rounded-xl border border-border px-3 py-2.5" style={{ ["--i" as any]: i }}>
                  <Ghost className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.role_title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.company_name}</p>
                  </div>
                  <Badge tone="neutral">{fmt.ago(a.ghosted_at)}</Badge>
                  <Link href={`/applications/${a.id}`} className="text-xs font-semibold text-accent hover:underline">
                    open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      {!summary.isPending && summary.data && (
        <InlineBanner tone="info" title="Weekly digest preview">
          {(summary.data.kpis.applications as any)?.value ?? 0} applied · {(summary.data.kpis.replies as any)?.value ?? 0} replied ·{" "}
          {(summary.data.kpis.interviews as any)?.value ?? 0} interviews this {period}, median first reply {fmt.days(summary.data.median_time_to_reply_days)},
          p90 {fmt.days(summary.data.p90_time_to_reply_days)}. The identical card ships in Monday’s email.
        </InlineBanner>
      )}
    </div>
  );
}
