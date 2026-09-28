"use client";

/** Posting detail (§40.2): full JD + score explain + capture + CV suggestion. */
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, FileText, Save } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { CV, JobPosting } from "@/types";
import { Badge, Button, Card, Skeleton } from "@/components/ui/base";
import { ErrorState, InlineBanner } from "@/components/ui/feedback";
import { fmt } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const job = useQuery<JobPosting & { description?: string; jd_keywords?: string[] }>({
    queryKey: qk.job(id),
    queryFn: () => appFetch(`/jobs/${id}`, { _auth: true }),
  });

  const suggestions = useQuery<{ cv: CV; match: number | null }[]>({
    queryKey: ["cvs", "suggest", id],
    queryFn: () => appFetch(`/cvs/${(job.data as any)?.id ?? id}/suggest`, { params: { posting_id: id }, _auth: true }).catch(() => []),
    enabled: !!job.data,
  });

  const capture = useMutation({
    mutationFn: () =>
      appFetch<any>("/capture", {
        method: "POST",
        body: { source: "manual", url: job.data!.url, page: { title: `${job.data!.title} — ${job.data!.company.name}`, company_guess: job.data!.company.name, text_excerpt: job.data!.description }, action: "create_draft" },
        _auth: true,
      }),
    meta: { invalidates: [["applications"], ["jobs"], ["analytics"], ["streaks"]] },
    onSuccess: (data) => {
      toast("Draft application created", "success");
      router.push(`/applications/${data.application_id}`);
    },
    onError: (e: any) => toast(e.message ?? "Capture failed", "error"),
  });

  if (job.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (job.error) return <ErrorState error={job.error} onRetry={() => job.refetch()} />;
  const j = job.data!;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold">{j.title}</h1>
            <p className="text-sm text-muted-foreground">
              {j.company.name} · {j.location ?? "Unspecified"} {j.remote && "· Remote"} · {j.source}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-extrabold text-accent">{j.score.toFixed(0)}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">match score</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {j.salary && (
            <Badge tone="mint">
              {j.salary.currency} {fmt.n(j.salary.min)}–{fmt.n(j.salary.max)}
            </Badge>
          )}
          {j.seniority && <Badge tone="orchid" className="capitalize">{j.seniority}</Badge>}
          {j.posted_at && <Badge tone="neutral">posted {fmt.ago(j.posted_at)}</Badge>}
          {j.applied && <Badge tone="mint">already applied ✓</Badge>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="azure" onClick={() => capture.mutate()} disabled={capture.isPending}>
            <Save className="h-4 w-4" /> Track this posting
          </Button>
          <a href={j.url} target="_blank" rel="noreferrer">
            <Button variant="outline">
              <ExternalLink className="h-4 w-4" /> Open original
            </Button>
          </a>
        </div>
      </Card>

      {/* explainability */}
      <Card className="p-5">
        <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Why it ranked here</h2>
        <div className="space-y-3">
          {(j.explain ?? []).map((e) => (
            <div key={e.factor}>
              <div className="flex justify-between text-xs">
                <span className="font-medium capitalize">{e.factor}</span>
                <span className="tnum font-mono text-muted-foreground">
                  {e.points.toFixed(1)} / {(e.weight * 100).toFixed(0)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-[width] duration-700" style={{ width: `${Math.min(100, (Math.abs(e.points) / (e.weight * 100)) * 100)}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{e.why}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* JD match (§24.1) */}
      {suggestions.data && suggestions.data.length > 0 && (
        <Card className="p-5">
          <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Best CV for this posting</h2>
          <div className="space-y-2">
            {suggestions.data.slice(0, 3).map(({ cv, match }) => (
              <Link key={cv.id} href={`/studio/cvs/${cv.id}?posting=${id}`} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-muted">
                <FileText className="h-4 w-4 text-orange-500" />
                <span className="flex-1 text-sm font-medium">{cv.name}</span>
                <Badge tone={cv.archetype === "pitch" ? "orchid" : "azure"} className="capitalize">
                  {cv.archetype}
                </Badge>
                {match != null && <span className="tnum text-xs font-bold text-success">{Math.round(match * 100)}% fit</span>}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {j.description && (
        <Card className="p-5">
          <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Description</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{j.description}</p>
        </Card>
      )}

      {!j.description && <InlineBanner tone="info">The full JD wasn’t available from this source — open the original for the complete posting.</InlineBanner>}
    </div>
  );
}
