"use client";

/** Quick capture (§19.2): paste URL → server parses (JSON-LD/og/regex) → confirm → draft created. */
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Check, ClipboardPaste, Crosshair, Loader2, Rocket } from "lucide-react";
import { appFetch } from "@/lib/api";
import { Badge, Button, Card, Input, Label, Select, Skeleton, Textarea } from "@/components/ui/base";
import { InlineBanner } from "@/components/ui/feedback";
import { fmt } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Parsed = {
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  description: string;
  keywords: string[];
  posted_at: string | null;
  warnings: string[];
};

export default function CapturePage() {
  return (
    <React.Suspense fallback={null}>
      <CapturePageInner />
    </React.Suspense>
  );
}

function CapturePageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [url, setUrl] = React.useState(search.get("url") ?? "");
  const [pageText, setPageText] = React.useState("");
  const [parsed, setParsed] = React.useState<Parsed | null>(null);
  const [action, setAction] = React.useState<"log_only" | "create_draft" | "mark_submitted">("create_draft");

  const preview = useMutation({
    mutationFn: () =>
      appFetch<{ parsed: Parsed; warnings: string[] }>("/capture/preview", {
        method: "POST",
        body: { url: url.trim(), html_text: pageText.trim() || undefined },
        _auth: true,
      }),
    onSuccess: (res) => {
      setParsed(res.parsed);
      if (res.warnings.length) toast(res.warnings.join("; "), "info");
    },
    onError: (e: any) => toast(e?.error?.detail ?? e?.message ?? "Could not parse that URL", "error"),
  });

  const confirm = useMutation({
    mutationFn: () =>
      appFetch<{ application_id: string | null; posting_id: string; score: number }>("/capture", {
        method: "POST",
        body: { source: "paste", url: url.trim(), html_text: pageText.trim() || undefined, action },
        _auth: true,
      }),
    meta: { invalidates: [["applications"], ["jobs"], ["analytics"], ["streaks"]] },
    onSuccess: (res) => {
      toast(`Captured, scored ${res.score}`, "success");
      if (res.application_id) router.push(`/applications/${res.application_id}`);
      else router.push("/tracker");
    },
    onError: (e: any) => toast(e?.error?.detail ?? e?.message ?? "Capture failed", "error"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Quick capture</h1>
        <p className="text-sm text-muted-foreground">Paste a posting URL, JSON-LD, OpenGraph and text patterns are parsed server-side (§19.2).</p>
      </header>

      <Card className="space-y-4 p-5">
        <div>
          <Label>Posting URL</Label>
          <div className="flex gap-2">
            <Input placeholder="https://boards.example.com/jobs/12345" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && url && preview.mutate()} />
            <Button onClick={() => preview.mutate()} disabled={!url.trim() || preview.isPending}>
              {preview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              Parse
            </Button>
          </div>
        </div>

        <div>
          <Label>Page text (fallback if the site blocks fetching)</Label>
          <Textarea
            value={pageText}
            onChange={(e) => setPageText(e.target.value)}
            placeholder="Right-click → View source, or paste the posting text here. Respect robots.txt, the server refuses to fetch disallowed URLs."
            className="min-h-[90px]"
          />
        </div>

        {preview.isPending && <Skeleton className="h-40 w-full" />}
      </Card>

      {parsed && (
        <Card className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Parsed preview</p>
              <h2 className="font-display text-xl font-extrabold">{parsed.title}</h2>
              <p className="text-sm text-muted-foreground">
                {parsed.company} · {parsed.location ?? "location unknown"}
                {parsed.remote && " · remote"}
              </p>
            </div>
            <Badge tone="mint">
              <Check className="h-3 w-3" /> parsed
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Field label="Salary" value={parsed.salary_min ? `${parsed.currency}${fmt.n(parsed.salary_min)}${parsed.salary_max ? `–${parsed.currency}${fmt.n(parsed.salary_max)}` : ""}` : "n/a"} />
            <Field label="Posted" value={fmt.date(parsed.posted_at)} />
            <Field label="Keywords" value={String(parsed.keywords.length)} />
            <Field label="Source" value="paste" />
          </div>

          {parsed.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {parsed.keywords.slice(0, 12).map((k) => (
                <Badge key={k}>{k}</Badge>
              ))}
            </div>
          )}

          <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{parsed.description}</p>

          {parsed.warnings.length > 0 && (
            <InlineBanner tone="warn" title="Check these">
              <ul className="list-disc space-y-0.5 pl-4">
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </InlineBanner>
          )}

          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <div>
              <Label>What should happen?</Label>
              <Select value={action} onChange={(e) => setAction(e.target.value as any)} className="w-56">
                <option value="create_draft">Create application draft</option>
                <option value="log_only">Log posting only (saved)</option>
                <option value="mark_submitted">Mark as submitted</option>
              </Select>
            </div>
            <Button variant="success" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
              {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Capture it
            </Button>
            <Button variant="outline" onClick={() => setParsed(null)}>
              Discard
            </Button>
          </div>
        </Card>
      )}

      {!parsed && !preview.isPending && (
        <Card className="flex items-center gap-4 p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500/12 text-orange-700 dark:text-orange-400">
            <ClipboardPaste className="h-5 w-5" />
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            No browser extension required: paste the URL, review the parse, confirm. Autofill mappings learned from past forms are applied
            when you open the posting in the tracker.
          </p>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="tnum font-medium">{value}</p>
    </div>
  );
}
