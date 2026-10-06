"use client";

/** Victory (§23.1 “I got a job”), takeover celebration + campaign summary, confetti included. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PartyPopper, Trophy } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { Application, Paged } from "@/types";
import { Button, Card, Select } from "@/components/ui/base";
import { fireConfetti } from "@/lib/confetti";
import { toast } from "@/hooks/use-toast";

type VictoryResult = {
  celebrated: boolean;
  summary: { applications: number; effort: number; days: number; streak: number };
};

export default function VictoryPage() {
  const router = useRouter();
  const [appId, setAppId] = React.useState("");
  const [result, setResult] = React.useState<VictoryResult | null>(null);

  const offers = useQuery<Paged<Application>>({
    queryKey: qk.applicationList({ status: "offer" }),
    queryFn: () => appFetch("/applications", { params: { status: "offer", page_size: 50 }, _auth: true }),
  });

  const celebrate = useMutation({
    mutationFn: () =>
      appFetch<VictoryResult>("/streaks/victory", {
        method: "POST",
        body: { offer_source: "manual", application_id: appId || undefined },
        _auth: true,
      }),
    meta: { invalidates: [["streaks"], ["applications"], ["analytics"]], errorFallback: "Could not record victory" },
    onSuccess: (res) => {
      setResult(res);
      fireConfetti({ slowmo: true });
      toast("Congratulations! 🎉", "success");
    },
  });

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center text-center">
      {result ? (
        <Card className="w-full p-8">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[image:var(--gradient-brand)] text-white shadow-xl shadow-orange-900/30">
            <Trophy className="h-10 w-10" />
          </span>
          <h1 className="font-display mt-5 text-4xl font-extrabold">
            You got the job. <span className="text-gradient-brand">🎉</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">The campaign is closed. Take the win, then rest.</p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={result.summary.applications} label="applications sent" />
            <Stat value={result.summary.effort} label="total effort" />
            <Stat value={result.summary.days} label="days hunting" />
            <Stat value={result.summary.streak} label="final streak" />
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
            <Button variant="outline" onClick={() => setResult(null)}>
              Record another
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="w-full p-8">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ink/10 text-ink">
            <PartyPopper className="h-8 w-8" />
          </span>
          <h1 className="font-display mt-4 text-3xl font-extrabold">I got a job</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Fires the victory takeover: confetti, campaign totals, and the tracker closes out (§23.1).
          </p>

          <div className="mx-auto mt-5 max-w-sm text-left">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Link to an offer (optional)</label>
            <Select value={appId} onChange={(e) => setAppId(e.target.value)}>
              <option value=""> just celebrate,</option>
              {offers.data?.items.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company_name} · {a.role_title}
                </option>
              ))}
            </Select>
          </div>

          <Button size="lg" className="mt-5" onClick={() => celebrate.mutate()} disabled={celebrate.isPending}>
            {celebrate.isPending ? "Recording…" : "Celebrate 🎉"}
          </Button>

          <button onClick={() => router.push("/dashboard")} className="mt-4 block w-full text-xs text-muted-foreground hover:text-foreground">
            not yet, back to the hunt
          </button>
        </Card>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="tnum font-display text-2xl font-extrabold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
