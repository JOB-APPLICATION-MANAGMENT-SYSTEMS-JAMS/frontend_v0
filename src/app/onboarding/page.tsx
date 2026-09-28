"use client";

/** Onboarding (§6): three quick steps after signup — identity, goal, first hunt. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Compass, Flag, UserRound } from "lucide-react";
import { appFetch } from "@/lib/api";
import { Button, Card, Input, Label, ProgressBar } from "@/components/ui/base";
import { toast } from "@/hooks/use-toast";

const STEPS = ["You", "Goal", "Hunt"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [headline, setHeadline] = React.useState("");
  const [goal, setGoal] = React.useState("20");

  const saveProfile = useMutation({
    mutationFn: () => appFetch("/profile", { method: "PUT", body: { identity: { full_name: name.trim(), headline: headline.trim() } }, _auth: true }),
    meta: { invalidates: [["profile"]] },
  });

  const saveGoal = useMutation({
    mutationFn: () => appFetch("/goals", { method: "PUT", body: { goal: Number(goal) }, _auth: true }),
    meta: { invalidates: [["streaks"]] },
  });

  const next = async () => {
    if (step === 0) {
      if (!name.trim()) return toast("Add your name to continue", "error");
      await saveProfile.mutateAsync().catch((e) => toast(e?.message ?? "Could not save", "error"));
    }
    if (step === 1) {
      await saveGoal.mutateAsync().catch(() => undefined);
    }
    if (step === STEPS.length - 1) {
      router.replace("/dashboard");
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(1200px_600px_at_20%_-10%,hsl(22_92%_52%/.14),transparent),radial-gradient(900px_500px_at_90%_10%,hsl(14_76%_46%/.1),transparent)] px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <span className="h-8 w-8 rounded-lg bg-[image:var(--gradient-brand)] shadow-lg shadow-orange-900/20" />
          <span className="font-display text-xl font-extrabold tracking-tight">JAMS</span>
          <span className="ml-auto text-xs text-muted-foreground">
            step {step + 1}/{STEPS.length}
          </span>
        </div>

        <ProgressBar value={((step + 1) / STEPS.length) * 100} className="mb-5" />

        <Card className="p-6">
          {step === 0 && (
            <>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500/12 text-orange-700 dark:text-orange-400">
                <UserRound className="h-5 w-5" />
              </span>
              <h1 className="font-display mt-4 text-2xl font-extrabold">Who’s hunting?</h1>
              <p className="mt-1 text-sm text-muted-foreground">Your profile powers scoring, CV blocks, and autofill.</p>
              <div className="mt-5 space-y-3">
                <div>
                  <Label>Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoFocus />
                </div>
                <div>
                  <Label>Headline (optional)</Label>
                  <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Frontend engineer · React/TypeScript" />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink/10 text-ink">
                <Flag className="h-5 w-5" />
              </span>
              <h1 className="font-display mt-4 text-2xl font-extrabold">Set a daily goal</h1>
              <p className="mt-1 text-sm text-muted-foreground">The streak ring tracks it every local day. 20 is honest for an active hunt — change it anytime.</p>
              <div className="mt-5">
                <Label>Applications per day</Label>
                <Input type="number" min={1} max={500} value={goal} onChange={(e) => setGoal(e.target.value)} className="w-32" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/12 text-amber-700 dark:text-amber-400">
                <Compass className="h-5 w-5" />
              </span>
              <h1 className="font-display mt-4 text-2xl font-extrabold">You’re ready</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Free boards (Arbeitnow, Remotive, RemoteOK, HN, Greenhouse/Lever/Ashby) are indexed, your profile is set — the dashboard is
                waiting.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>
                  <span className="font-semibold text-foreground">/discover</span> — search & score live postings
                </li>
                <li>
                  <span className="font-semibold text-foreground">c</span> — quick-add an application
                </li>
                <li>
                  <span className="font-semibold text-foreground">⌘K</span> — anything, instantly
                </li>
              </ul>
            </>
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => (step === 0 ? router.replace("/dashboard") : setStep((s) => s - 1))}>
              {step === 0 ? "Skip" : "Back"}
            </Button>
            <Button onClick={next} disabled={saveProfile.isPending || saveGoal.isPending}>
              {step === STEPS.length - 1 ? "Open dashboard" : "Continue"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
