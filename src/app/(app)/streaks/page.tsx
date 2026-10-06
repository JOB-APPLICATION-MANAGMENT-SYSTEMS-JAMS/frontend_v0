"use client";

/** Streaks (§23): goal hero + ring, badges, freeze, day-by-day history, manual effort log. */
import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Award, Flame, Gift, Minus, Plus, Snowflake, Trophy } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { Badge as BadgeT, Today } from "@/types";
import { Badge, Button, Card, Input, Label, Skeleton } from "@/components/ui/base";
import { EmptyState, InlineBanner } from "@/components/ui/feedback";
import { InfoButton } from "@/components/ui/modal";
import { GoalRing } from "@/components/shell/goal-ring";
import { fmt } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { fireConfetti } from "@/lib/confetti";

type HistoryDay = { day: string; applications: number; goal: number; hit: 0 | 1; streak_value: number; frozen: 0 | 1 };

export default function StreaksPage() {
  const router = useRouter();
  const [goal, setGoal] = React.useState<string>("");
  const celebrated = React.useRef(false);

  const today = useQuery<Today>({ queryKey: qk.today(), queryFn: () => appFetch("/streaks/today", { _auth: true }) });
  const badges = useQuery<{ items: BadgeT[] }>({ queryKey: qk.badges(), queryFn: () => appFetch("/streaks/badges", { _auth: true }) });
  const history = useQuery<{ items: HistoryDay[] }>({
    queryKey: ["streaks", "history"],
    queryFn: () => appFetch("/streaks/history", { params: { days: 120 }, _auth: true }),
  });

  React.useEffect(() => {
    if (today.data?.hit && !celebrated.current) {
      celebrated.current = true;
      fireConfetti();
    }
  }, [today.data?.hit]);

  const [goalSeeded, setGoalSeeded] = React.useState(false);
  // seed the goal field once today's numbers land (adjust-during-render, not an effect)
  if (!goalSeeded && today.data) {
    setGoalSeeded(true);
    setGoal(String(today.data.goal));
  }

  const setGoalMutation = useMutation({
    mutationFn: () => appFetch("/streaks/goals", { method: "PUT", body: { goal: Number(goal) }, _auth: true }),
    meta: { invalidates: [["streaks"], ["analytics"]] },
    onSuccess: () => toast("Daily goal updated", "success"),
  });

  const logEffort = useMutation({
    mutationFn: () => appFetch("/streaks/log", { method: "POST", body: { weight: 1 }, _auth: true }),
    meta: { invalidates: [["streaks"]] },
    onSuccess: () => toast("Effort logged, goal ring updated", "success"),
  });

  const t = today.data;
  const maxDay = Math.max(1, ...(history.data?.items ?? []).map((d) => d.applications));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* hero */}
      <Card className="relative overflow-hidden p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <GoalRing today={t} size={110} />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t?.day ?? "today"}</p>
                <InfoButton
                  title="Your goal ring"
                  body={
                    <>
                      <p>The ring fills as you log applications towards your daily goal. Hitting it flips the day green and keeps your streak alive.</p>
                      <p>Any effort counts too: pitches and follow-ups feed an any-effort streak that never breaks on quiet days.</p>
                    </>
                  }
                />
              </div>
              <h1 className="font-display text-3xl font-extrabold">
                {t?.hit ? (
                  <span className="text-gradient-brand">Goal smashed 🎯</span>
                ) : (
                  <>
                    <span className="tnum text-gradient-brand">{t?.count ?? 0}/{t?.goal ?? 20}</span> today
                  </>
                )}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Flame className="h-4 w-4 text-orange-500" /> {t?.streak ?? 0} day streak
                </span>
                <span>longest {t?.longest_streak ?? 0}</span>
                <span>any-effort {t?.any_effort_streak ?? 0}</span>
                {t?.frozen && (
                  <Badge tone="azure">
                    <Snowflake className="h-3 w-3" /> frozen
                  </Badge>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <div>
                <Label className="mb-1">Daily goal</Label>
                <Input type="number" min={1} max={500} value={goal} onChange={(e) => setGoal(e.target.value)} className="w-24" />
              </div>
              <Button size="sm" onClick={() => setGoalMutation.mutate()} disabled={!goal || Number(goal) < 1 || setGoalMutation.isPending}>
                Save
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => logEffort.mutate()} disabled={logEffort.isPending}>
                <Plus className="h-3.5 w-3.5" /> Log an effort (pitch, follow-up)
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              freeze available: {t?.freeze_available ?? 0} · free tier keeps streaks honest (§23.1)
            </p>
          </div>
        </div>

        {!t?.hit && t && (
          <InlineBanner tone="info" className="mt-4" title={`${t.remaining} to go`}>
            Any effort counts, applications, pitches, and follow-ups all feed the ring.
          </InlineBanner>
        )}
      </Card>

      {/* badges */}
      <Card className="p-5">
        <h2 className="font-display mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Award className="h-4 w-4" /> Badges
          <InfoButton
            title="Badges"
            body="Milestones you unlock automatically as you apply: first application, hundred applications, reply records, streak lengths. Locked badges stay greyed until the condition is met, so nothing here can be bought or grinded."
          />
        </h2>
        {badges.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {badges.data!.items.map((b, i) => (
              <div
                key={b.key}
                className={`animate-stagger rounded-xl border p-4 text-center transition-all ${b.unlocked ? "border-amber-500/45 bg-amber-500/10" : "border-border opacity-55 grayscale"}`}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className={`mx-auto grid h-10 w-10 place-items-center rounded-full ${b.unlocked ? "bg-[image:var(--gradient-brand)] text-white" : "bg-muted"}`}>
                  <Trophy className="h-5 w-5" />
                </span>
                <p className="mt-2 text-xs font-semibold">{b.label}</p>
                <p className="text-[10px] text-muted-foreground">{b.unlocked ? fmt.date(b.unlocked_at) : "locked"}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* history */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Last 120 days
            <InfoButton
              title="Day-by-day history"
              body="One bar per day for the last 120 days; bar height is applications logged. Gold means the goal was hit, grey means a freeze covered the day, orange means partial progress."
            />
          </h2>
          <p className="text-[11px] text-muted-foreground">gold bar = goal hit · ringed = freeze used</p>
        </div>
        {history.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : (history.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No history yet" description="Your first logged day appears here." />
        ) : (
          <>
            <div className="flex h-28 items-end gap-[3px]">
              {[...history.data!.items].reverse().map((d, i) => (
                <div
                  key={d.day}
                  className="group relative flex-1 rounded-t-sm transition-all duration-500"
                  title={`${d.day}: ${d.applications}/${d.goal}${d.hit ? " · hit" : ""}`}
                  style={{
                    height: `${Math.max(4, (d.applications / maxDay) * 100)}%`,
                    background: d.hit ? "hsl(40 90% 52% / .9)" : d.frozen ? "hsl(210 10% 70% / .7)" : "hsl(22 92% 52% / .6)",
                    "--i": Math.min(i, 12),
                  } as React.CSSProperties}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>{fmt.date(history.data!.items[history.data!.items.length - 1]?.day)}</span>
              <span>today</span>
            </div>
          </>
        )}
      </Card>

      {/* freeze explainer */}
      <Card className="flex items-center gap-4 p-5">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500/12 text-orange-700 dark:text-orange-400">
          <Minus className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">One freeze per week</p>
          <p className="text-xs text-muted-foreground">
            Miss a day? Spend a freeze to keep the streak alive, earned again by hitting tomorrow’s goal. No paywalls, no energy mechanics.
          </p>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => toast("Freezes are spent automatically when you miss a day", "info")}>
          <Snowflake className="h-3.5 w-3.5" /> How freezes work
        </Button>
      </Card>

      <div className="text-center">
        <Button variant="success" onClick={() => router.push("/victory")}>
          <Gift className="h-4 w-4" /> I got a job!
        </Button>
      </div>
    </div>
  );
}
