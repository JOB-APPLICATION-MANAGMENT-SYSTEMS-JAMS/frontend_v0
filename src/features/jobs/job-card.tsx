"use client";

/** Result card (§25.1): title · company · salary · posted-ago · source badge · explainable score. */
import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Check, ExternalLink, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import { Badge, Button } from "@/components/ui/base";
import { cn, fmt } from "@/lib/utils";
import type { JobPosting } from "@/types";
import { toast } from "@/hooks/use-toast";

export function JobCard({ job, onOpen, dense = false }: { job: JobPosting; onOpen?: () => void; dense?: boolean }) {
  const [explaining, setExplaining] = React.useState(false);

  const vote = useMutation({
    mutationFn: (vote: "up" | "down" | "ignore") => appFetch(`/jobs/${job.id}/feedback`, { method: "POST", body: { vote }, _auth: true }),
    meta: { invalidates: [[ "jobs" ], [ "applications" ]], silentError: true },
  });

  const capture = useMutation({
    mutationFn: () => appFetch<any>("/capture", { method: "POST", body: { source: "paste", url: job.url, page: { title: `${job.title}, ${job.company.name}`, company_guess: job.company.name, text_excerpt: job.description_snippet }, action: "create_draft" }, _auth: true }),
    meta: { invalidates: [["applications"], ["jobs"], ["streaks"], ["analytics"]] },
    onSuccess: () => toast("Saved to tracker as a draft application", "success"),
  });

  /**
   * Auto-apply: track it, then send by email when SMTP is configured (Gmail
   * compose hand-off otherwise). With no email for the company it opens the
   * posting instead: the manual path is never taken away, and either way the
   * attempt lands in the tracker.
   */
  const autoApply = useMutation({
    mutationFn: async () => {
      const cap = await appFetch<any>("/capture", {
        method: "POST",
        body: { source: "paste", url: job.url, page: { title: `${job.title}, ${job.company.name}`, company_guess: job.company.name, text_excerpt: job.description_snippet }, action: "create_draft", kind: "application" },
        _auth: true,
      });
      return appFetch<{ mode: "sent" | "compose" | "open"; compose_url?: string; email?: string; url?: string | null; reason?: string }>(`/applications/${cap.application_id}/auto-apply`, { method: "POST", body: {}, _auth: true });
    },
    meta: { invalidates: [["applications"], ["jobs"], ["outreach"], ["streaks"], ["analytics"]] },
    onSuccess: (res) => {
      if (res.mode === "sent") toast(`Application sent to ${res.email}`, "success");
      else if (res.mode === "compose" && res.compose_url) {
        window.open(res.compose_url, "_blank", "noopener");
        toast("Gmail compose opened; press Send there", "info");
      } else {
        if (res.url) window.open(res.url, "_blank", "noopener");
        toast(res.reason ?? "Opened the posting so you can apply manually", "info");
      }
    },
    onError: (e: any) => toast(e.detail ?? e.message ?? "Auto-apply failed", "error"),
  });

  const scoreTone = job.score >= 75 ? "mint" : job.score >= 50 ? "azure" : "amber";

  return (
    <article
      className={cn(
        "glass-card glass-hover group relative flex flex-col gap-3 rounded-2xl p-4",
        job.ignored && "opacity-45",
        job.applied && "ring-1 ring-emerald-500/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onOpen} className="truncate font-display text-[15px] font-bold hover:text-accent">
              {job.title}
            </button>
            {job.applied && <Badge tone="mint">applied ✓</Badge>}
            {job.company.tier && <Badge tone={job.company.tier === "dream" ? "orchid" : job.company.tier === "reach" ? "azure" : "amber"}>{job.company.tier}</Badge>}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {job.company.name} · {job.location ?? "Unspecified"} {job.remote && "· Remote"}
          </p>
        </div>

        {/* score badge + hover explanation (§25.1: the algorithm is never a black box) */}
        <div className="relative">
          <button
            onMouseEnter={() => setExplaining(true)}
            onMouseLeave={() => setExplaining(false)}
            onFocus={() => setExplaining(true)}
            onBlur={() => setExplaining(false)}
            onClick={() => setExplaining((v) => !v)}
            className={cn("rounded-full border px-2.5 py-1 font-mono text-xs font-bold", scoreTone === "mint" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", scoreTone === "azure" && "border-orange-600/35 bg-orange-600/12 text-orange-700 dark:text-orange-400", scoreTone === "amber" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400")}
            title="Why this ranked here"
          >
            {job.score.toFixed(0)}
          </button>
          {explaining && (
            <div className="glass-panel absolute right-0 top-8 z-20 w-72 rounded-2xl p-3.5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Why {job.score.toFixed(0)}?</p>
              {job.explain.slice(0, 5).map((e) => (
                <div key={e.factor} className="mb-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium capitalize">{e.factor}</span>
                    <span className="tnum font-mono">
                      {e.points.toFixed(1)}/{(e.weight * 100).toFixed(0)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-[width] duration-700"
                      style={{ width: `${Math.min(100, Math.abs(e.points) / Math.max(1, e.weight * 100) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{e.why}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Badge tone="neutral" className="capitalize">
          {job.source}
        </Badge>
        {job.salary && (
          <Badge tone="azure">
            {job.salary.currency} {fmt.n(job.salary.min)}–{fmt.n(job.salary.max)}
          </Badge>
        )}
        {job.posted_at && <span className="text-muted-foreground">posted {fmt.ago(job.posted_at)}</span>}
        {job.seniority && <Badge tone="orchid" className="capitalize">{job.seniority}</Badge>}
      </div>

      {!dense && job.description_snippet && <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{job.description_snippet}</p>}

      <div className="mt-auto flex items-center gap-1.5 border-t border-border pt-2.5">
        <Button size="sm" variant={job.applied ? "success" : "azure"} onClick={() => capture.mutate()} disabled={capture.isPending || job.applied}>
          <Check className="h-3.5 w-3.5" /> {job.applied ? "In tracker" : "Track this"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => autoApply.mutate()} disabled={autoApply.isPending || job.applied} title="Track it and send my application by email (opens the posting when no email is known)">
          <Send className="h-3.5 w-3.5" /> {autoApply.isPending ? "Sending…" : "Auto-apply"}
        </Button>
        <a href={job.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted">
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </a>
        <div className="ml-auto flex items-center">
          <button onClick={() => vote.mutate("up")} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600" title="More like this">
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => vote.mutate("down")} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600" title="Less like this">
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => vote.mutate("ignore")} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted" title="Ignore">
            <X className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => vote.mutate("ignore")} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-ink/10 hover:text-foreground" title="Save for later">
            {job.ignored ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </article>
  );
}
