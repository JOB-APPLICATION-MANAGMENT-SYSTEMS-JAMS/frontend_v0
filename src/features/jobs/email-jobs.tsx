"use client";

/**
 * Jobs with emails (§25.4): every posting that publishes an apply-by-email address,
 * from the free boards (Arbeitnow, Remotive, RemoteOK, Jobicy, Working Nomads) and
 * the HN “Who is hiring” thread, where founders print their inbox directly.
 *
 * This replaces the old social-search recipes: real jobs, a real address, one click
 * to send the application — SMTP when connected, Gmail compose hand-off otherwise.
 */
import * as React from "react";
import { useMutation, useQuery, keepPreviousData } from "@tanstack/react-query";
import { Copy, ExternalLink, Mail, RefreshCw, Search, Send } from "lucide-react";
import { appFetch } from "@/lib/api";
import { Badge, Button, Input } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { InfoButton } from "@/components/ui/modal";
import { toast } from "@/hooks/use-toast";
import { cn, fmt } from "@/lib/utils";
import type { SearchResponse } from "@/types";

type Job = SearchResponse["items"][number];

function EmailJobCard({ job }: { job: Job }) {
  const apply = useMutation({
    mutationFn: async () => {
      const cap = await appFetch<any>("/capture", {
        method: "POST",
        body: {
          source: "paste",
          url: job.url,
          page: {
            title: `${job.title}, ${job.company.name}`,
            company_guess: job.company.name,
            text_excerpt: job.description_snippet,
          },
          action: "create_draft",
          kind: "application",
          contact_email: job.contact_email ?? undefined,
        },
        _auth: true,
      });
      return appFetch<{ mode: "sent" | "compose" | "open"; compose_url?: string; email?: string; url?: string | null; reason?: string }>(
        `/applications/${cap.application_id}/auto-apply`,
        { method: "POST", body: {}, _auth: true }
      );
    },
    meta: { invalidates: [["applications"], ["jobs"], ["outreach"], ["streaks"], ["analytics"]] },
    onSuccess: (res) => {
      if (res.mode === "sent") toast(`Application sent to ${res.email}`, "success");
      else if (res.mode === "compose" && res.compose_url) {
        window.open(res.compose_url, "_blank", "noopener");
        toast("Gmail compose opened with your letter; press Send there", "info");
      } else {
        if (res.url) window.open(res.url, "_blank", "noopener");
        toast(res.reason ?? "Opened the posting so you can apply manually", "info");
      }
    },
    onError: (e: any) => toast(e.detail ?? e.message ?? "Could not send the application", "error"),
  });

  const copy = async () => {
    if (!job.contact_email) return;
    await navigator.clipboard.writeText(job.contact_email);
    toast("Email copied", "success");
  };

  return (
    <article className="glass-card glass-hover flex flex-col gap-2.5 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-bold">{job.title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {job.company.name} · {job.location ?? "Unspecified"} {job.remote && "· Remote"}
          </p>
        </div>
        <Badge tone="mint">email ✓</Badge>
      </div>

      <button
        onClick={copy}
        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-left text-xs hover:border-emerald-500/60"
        title="Click to copy the apply address"
      >
        <Mail className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="truncate font-medium">{job.contact_email}</span>
        <Copy className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge tone="neutral" className="capitalize">
          {job.source}
        </Badge>
        {job.salary && (
          <Badge tone="azure">
            {job.salary.currency} {fmt.n(job.salary.min)}–{fmt.n(job.salary.max)}
          </Badge>
        )}
        {job.posted_at && <span>posted {fmt.ago(job.posted_at)}</span>}
        {job.seniority && <Badge tone="orchid" className="capitalize">{job.seniority}</Badge>}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        <Button size="sm" variant="azure" onClick={() => apply.mutate()} disabled={apply.isPending || job.applied}>
          <Send className="h-3.5 w-3.5" /> {apply.isPending ? "Sending…" : job.applied ? "In tracker" : "Apply by email"}
        </Button>
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </a>
      </div>
    </article>
  );
}

export function EmailJobs() {
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const params = { has_email: "true", q: debouncedQ || undefined, page, page_size: 12 };

  const search = useQuery<SearchResponse>({
    queryKey: ["jobs", "with-email", debouncedQ, page],
    queryFn: () => appFetch("/jobs/search", { params: params as any, _auth: true }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
  });

  const refresh = useMutation({
    mutationFn: () => appFetch<any>("/jobs/refresh", { method: "POST", body: {}, _auth: true }),
    onSuccess: () => {
      toast("Indexing free sources — addresses land in seconds", "info");
      setTimeout(() => search.refetch(), 6000);
    },
    onError: (e: any) => toast(e.detail ?? e.message ?? "Refresh failed", "error"),
  });

  const total = search.data?.pagination.total_count ?? 0;
  const totalPages = search.data?.pagination.total_pages ?? 1;

  return (
    <div className="space-y-4">
      <div className="glass-sheet rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter jobs you can email: react, backend, Lagos…" className="pl-9" />
          </div>
          <Button variant="azure" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className={cn("h-3.5 w-3.5", refresh.isPending && "animate-spin")} /> Refresh sources
          </Button>
          <InfoButton
            title="Apply by email"
            body={
              <>
                <p>
                  Only postings with a <b>published email address</b> are shown: the HN “Who is hiring” thread (founders print their inbox), plus the free boards
                  (Arbeitnow · Remotive · RemoteOK · Jobicy · Working Nomads) where the ad itself carries one.
                </p>
                <p>
                  “Apply by email” tracks the application and sends your letter: straight over SMTP when connected, otherwise a prefilled Gmail compose tab. No
                  address here means you always still have “Open”.
                </p>
              </>
            }
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {search.data ? `${total} jobs with an apply address · ${search.data.took_ms}ms` : "searching…"}
          {Object.keys(search.data?.facets?.source ?? {}).length > 0 &&
            ` · sources: ${Object.entries(search.data!.facets.source)
              .sort((a, b) => b[1] - a[1])
              .map(([s, n]) => `${s} ${n}`)
              .join(" · ")}`}
        </p>
      </div>

      {search.isPending ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-card h-44 rounded-2xl p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
              <div className="mt-5 h-8 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : search.error ? (
        <ErrorState error={search.error} onRetry={() => search.refetch()} />
      ) : total === 0 ? (
        <EmptyState
          title="No address-bearing jobs indexed yet"
          description="Hit “Refresh sources” to pull the free boards and the HN hiring thread — postings that publish an inbox land here within seconds."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {search.data!.items.filter((j) => j.contact_email).map((job) => (
            <EmailJobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            page {page} / {totalPages}
          </span>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
