"use client";

/** Settings (§27): account, goal defaults, appearance, data export, source health, sign-out. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Database, Download, FileJson, LogOut, Moon, RefreshCw, Sun, User, Zap } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import { Badge, Button, Card, Input, Label, Select, Skeleton } from "@/components/ui/base";
import { InlineBanner } from "@/components/ui/feedback";
import { fmt } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Me = {
  user: { id: string; email: string; role: string; created_at: string };
  profile_exists: boolean;
  settings: { goal: number; timezone: string; mode: string };
  counts: { applications: number; cvs: number; postings: number };
};

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  // next-themes only knows the stored theme after mount, server always renders "system",
  // so the selected-button variant must stay "system" during hydration or the tree mismatches
  const [themeMounted, setThemeMounted] = React.useState(false);
  React.useEffect(() => setThemeMounted(true), []);
  const activeTheme = themeMounted ? theme : "system";
  const [goal, setGoal] = React.useState<string>("");
  const [signingOut, setSigningOut] = React.useState(false);

  const me = useQuery<Me>({ queryKey: qk.me(), queryFn: () => appFetch("/auth/me", { _auth: true }) });
  const sources = useQuery<{ items: any[] }>({ queryKey: ["sources"], queryFn: () => appFetch("/sources", { _auth: true }) });

  React.useEffect(() => {
    if (me.data && !goal) setGoal(String(me.data.settings.goal));
  }, [me.data, goal]);

  const saveGoal = useMutation({
    mutationFn: () => appFetch("/goals", { method: "PUT", body: { goal: Number(goal) }, _auth: true }),
    meta: { invalidates: [["streaks"], ["auth"]] },
    onSuccess: () => toast("Default daily goal saved", "success"),
  });

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
    } catch {
      toast("Export failed", "error");
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/session", { method: "DELETE" });
    } finally {
      router.replace("/login");
    }
  };

  if (me.isPending) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Settings</h1>
        <p className="text-sm text-muted-foreground">Account, defaults, appearance, and your data, all exportable (§31).</p>
      </header>

      {/* account */}
      <Card className="p-5">
        <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Email</Label>
            <Input value={me.data!.user.email} readOnly />
          </div>
          <div>
            <Label>Mode</Label>
            <Input value={me.data!.settings.mode} readOnly />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>
            <span className="tnum font-semibold text-foreground">{me.data!.counts.applications}</span> applications
          </span>
          <span>
            <span className="tnum font-semibold text-foreground">{me.data!.counts.cvs}</span> CVs
          </span>
          <span>
            <span className="tnum font-semibold text-foreground">{me.data!.counts.postings}</span> postings indexed
          </span>
          <span>member since {fmt.date(me.data!.user.created_at)}</span>
        </div>
        {/* profile lives here now that the rail only carries the seven core destinations */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/profile")}>
            <User className="h-4 w-4" /> Edit profile
          </Button>
        </div>
      </Card>

      {/* goals */}
      <Card className="p-5">
        <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Defaults</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Daily application goal</Label>
            <Input type="number" min={1} max={500} className="w-28" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label>Timezone</Label>
            <Input value={me.data!.settings.timezone} readOnly />
          </div>
          <Button onClick={() => saveGoal.mutate()} disabled={!goal || saveGoal.isPending}>
            Save
          </Button>
        </div>
      </Card>

      {/* appearance */}
      <Card className="p-5">
        <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Appearance</h2>
        <div className="flex gap-2">
          <Button variant={activeTheme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")}>
            <Sun className="h-4 w-4" /> Light
          </Button>
          <Button variant={activeTheme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}>
            <Moon className="h-4 w-4" /> Dark
          </Button>
          <Button variant={activeTheme === "system" ? "default" : "outline"} size="sm" onClick={() => setTheme("system")}>
            <Zap className="h-4 w-4" /> System
          </Button>
        </div>
      </Card>

      {/* data */}
      <Card className="p-5">
        <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Your data</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => download("json")}>
            <FileJson className="h-4 w-4" /> Export JSON
          </Button>
          <Button variant="outline" onClick={() => download("csv")}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
        <InlineBanner tone="info" className="mt-3" title="No lock-in">
          Everything is one file away, profile, applications, events, CVs, templates, companies, outreach, streaks.
        </InlineBanner>
      </Card>

      {/* source health */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Database className="h-4 w-4" /> Free source health
          </h2>
          <Button size="sm" variant="ghost" onClick={() => sources.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        {sources.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {sources.data!.items.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                <span className="text-sm font-medium capitalize">{String(s.name).replace(/_/g, " ")}</span>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {s.last_run_at ? fmt.ago(s.last_run_at) : "never"}
                  <Badge tone={s.error_streak > 1 ? "rose" : s.enabled ? "mint" : "neutral"}>{s.error_streak > 1 ? "failing" : s.enabled ? "ok" : "off"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-between border-t border-border pt-5">
        <Button variant="outline" onClick={() => router.push("/victory")}>
          I got a job 🎉
        </Button>
        <Button variant="destructive" onClick={signOut} disabled={signingOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}
