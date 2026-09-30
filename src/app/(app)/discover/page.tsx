"use client";

/** Discover (§25.1): sticky query bar, 300ms debounce, URL as source of truth, facets, radar sweep, partial results. */
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Briefcase, Building2, Mail, Radar, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { SearchResponse } from "@/types";
import { JobCard } from "@/features/jobs/job-card";
import { PitchTargets } from "@/features/jobs/pitch-targets";
import { EmailJobs } from "@/features/jobs/email-jobs";
import { Card, Button, Badge, Input, Skeleton, Kbd } from "@/components/ui/base";
import { EmptyState, ErrorState, InlineBanner } from "@/components/ui/feedback";
import { InfoButton } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const t = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ref = React.useRef(fn);
  ref.current = fn;
  return React.useCallback((...args: any[]) => {
    clearTimeout(t.current);
    t.current = setTimeout(() => (ref.current as any)(...args), delay);
  }, [delay]);
}

export default function DiscoverPage() {
  return (
    <React.Suspense fallback={null}>
      <DiscoverPageInner />
    </React.Suspense>
  );
}

function DiscoverPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = React.useState(params.get("q") ?? "");
  const [showFilters, setShowFilters] = React.useState(false);
  const mode = ((params.get("mode") ?? "jobs") === "social" ? "email" : (params.get("mode") ?? "jobs")) as "jobs" | "pitch" | "email";

  const patch = React.useCallback(
    (next: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === undefined || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      sp.set("page", next.page ?? "1");
      router.replace(`/discover?${sp.toString()}`, { scroll: false });
    },
    [params, router]
  );

  const pushText = useDebouncedCallback((v: string) => patch({ q: v }), 300); // §25.1 300ms debounce

  const queryParams = {
    q: params.get("q") ?? undefined,
    location: params.get("location") ?? undefined,
    remote: params.get("remote") ?? undefined,
    source: params.get("source") ?? undefined,
    seniority: params.get("seniority") ?? undefined,
    sort: params.get("sort") ?? undefined,
    page: params.get("page") ?? "1",
    page_size: "12",
  };

  const search = useQuery<SearchResponse>({
    queryKey: qk.jobList(queryParams),
    queryFn: () => appFetch("/jobs/search", { params: queryParams as any, _auth: true }),
    placeholderData: keepPreviousData, // no flash between keystrokes (§34.5)
    staleTime: 30_000,
  });

  const sources = useQuery({
    queryKey: ["jobs", "sources"],
    queryFn: () => appFetch<{ items: any[] }>("/jobs/sources", { _auth: true }),
    staleTime: 60_000,
  });

  const facetSource = search.data?.facets?.source ?? {};
  const activeFilters = Object.entries(queryParams).filter(([k, v]) => v && k !== "page" && k !== "page_size");

  return (
    <div className="space-y-5">
      {/* mode tabs: jobs (free boards) · pitch targets (companies with no opening) · apply by email */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass-tab flex rounded-full p-0.5">
          {([[
            "jobs",
            "Jobs",
            Briefcase,
          ], [
            "pitch",
            "Pitch targets",
            Building2,
          ], [
            "email",
            "Apply by email",
            Mail,
          ]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => patch({ mode: key === "jobs" ? undefined : key })}
              className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold", mode === key ? "bg-[image:var(--gradient-brand)] text-white" : "text-muted-foreground hover:text-foreground")}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        <InfoButton
          title="Three ways to find your next role"
          body={
            <>
              <p>
                <b>Jobs</b> aggregates the free boards, ranked for software engineering in Nigeria first.
              </p>
              <p>
                <b>Pitch targets</b> finds Nigerian companies with no open role but an official email: send the pitch anyway.
              </p>
              <p>
                <b>Apply by email</b> lists only the postings that publish an address — including the HN “Who is hiring” thread — so you can send your
                application straight to a person.
              </p>
            </>
          }
        />
      </div>

      {mode === "pitch" && <PitchTargets />}
      {mode === "email" && <EmailJobs />}
      {mode === "jobs" && (
        <>
      {/* query bar */}
      <div className="glass-sheet sticky top-20 z-20 rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                pushText(e.target.value);
              }}
              placeholder="python · react · payments…   (try: react remote)"
              className="pl-9"
              autoFocus
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => setShowFilters((v) => !v)} title="Filters">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button
            variant="azure"
            onClick={async () => {
              try {
                await appFetch("/jobs/refresh", { method: "POST", body: {}, _auth: true });
                toast("Aggregating free sources…", "info");
                setTimeout(() => search.refetch(), 6000);
              } catch {
                toast("Refresh failed", "error");
              }
            }}
          >
            <RefreshCw className={cn("h-4 w-4", search.isFetching && "animate-spin")} /> Refresh
          </Button>
        </div>

        {/* source chips (progressive rendering signal, §25.1) */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {(sources.data?.items ?? []).map((s: any) => (
            <button
              key={s.name}
              onClick={() => patch({ source: queryParams.source === s.name ? undefined : s.name })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                queryParams.source === s.name ? "border-orange-600 bg-orange-600/12 text-orange-700 dark:border-orange-500 dark:bg-orange-500/12 dark:text-orange-400" : s.last_error ? "border-rose-400/50 bg-rose-500/10 text-rose-600" : "border-border text-muted-foreground hover:bg-muted"
              )}
              title={s.last_error ?? `last run ${s.last_run_at ?? "never"} · ${s.items_found} items`}
            >
              {s.name} {s.last_run_at ? `· ${s.items_found}` : "· idle"}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {search.data ? `${search.data.pagination.total_count} results in ${search.data.took_ms}ms` : "searching…"} {activeFilters.length > 0 && `· ${activeFilters.length} filters`}
            {activeFilters.length > 0 && (
              <button className="ml-2 font-semibold text-accent" onClick={() => router.replace("/discover")}>
                reset
              </button>
            )}
          </span>
        </div>

        {/* Nigeria quick filters: the search scope, one click away */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Nigeria:</span>
          {["Lagos", "Abuja", "Ogun", "Nigeria"].map((loc) => {
            const active = (queryParams.location ?? "").toLowerCase() === loc.toLowerCase();
            return (
              <button
                key={loc}
                onClick={() => patch({ location: active ? undefined : loc })}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active ? "border-orange-600 bg-orange-600/12 text-orange-700 dark:border-orange-500 dark:bg-orange-500/12 dark:text-orange-400" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                {loc}
              </button>
            );
          })}
          <span className="ml-1 text-[11px] text-muted-foreground">role:</span>
          {["software engineer", "frontend", "backend", "full stack", "devops"].map((term) => (
            <button
              key={term}
              onClick={() => patch({ q: (queryParams.q ?? "").toLowerCase() === term ? undefined : term })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                (queryParams.q ?? "").toLowerCase() === term ? "border-orange-600 bg-orange-600/12 text-orange-700 dark:border-orange-500 dark:bg-orange-500/12 dark:text-orange-400" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              {term}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="route-fade mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">Location</span>
              <Input defaultValue={queryParams.location ?? ""} onBlur={(e) => patch({ location: e.target.value })} placeholder="Remote, Lagos, Berlin…" />
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">Remote only</span>
              <div className="glass-tab flex rounded-full p-0.5">
                {[["any", undefined], ["yes", "true"]].map(([label, value]) => (
                  <button key={String(label)} onClick={() => patch({ remote: value as any })} className={cn("flex-1 rounded-full px-3 py-1.5 text-xs font-semibold", (queryParams.remote ?? undefined) === value ? "bg-[image:var(--gradient-brand)] text-white" : "text-muted-foreground")}>
                    {label}
                  </button>
                ))}
              </div>
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">Seniority</span>
              <div className="flex flex-wrap gap-1">
                {["junior", "mid", "senior", "staff"].map((s) => (
                  <button key={s} onClick={() => patch({ seniority: queryParams.seniority === s ? undefined : s })} className={cn("rounded-full border px-2.5 py-1 text-[11px] capitalize", queryParams.seniority === s ? "border-orange-600 bg-orange-600/12 text-orange-700 dark:border-orange-500 dark:bg-orange-500/12 dark:text-orange-400" : "border-border text-muted-foreground")}>
                    {s}
                  </button>
                ))}
              </div>
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">Sort</span>
              <div className="glass-tab flex rounded-full p-0.5">
                {[["score", "score"], ["recent", "newest"]].map(([value, label]) => (
                  <button key={value} onClick={() => patch({ sort: value === "score" ? undefined : value })} className={cn("flex-1 rounded-full px-3 py-1.5 text-xs font-semibold", (queryParams.sort ?? "score") === value ? "bg-[image:var(--gradient-brand)] text-white" : "text-muted-foreground")}>
                    {label}
                  </button>
                ))}
              </div>
            </label>
          </div>
        )}
      </div>

      {search.data && search.data.sources_failed.length > 0 && (
        <InlineBanner tone="warn" title="Partial results">
          {search.data.sources_failed.map((s) => s.source).join(", ")} didn’t respond, the rest of your results are complete.{" "}
          <Kbd className="ml-1">live sources retry on refresh</Kbd>
        </InlineBanner>
      )}

      {/* facet chips */}
      {Object.keys(facetSource).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(facetSource).map(([src, count]) => (
            <Badge key={src} tone={queryParams.source === src ? "azure" : "neutral"} className="cursor-pointer capitalize" onClick={() => patch({ source: queryParams.source === src ? undefined : src })}>
              {src} · {count}
            </Badge>
          ))}
        </div>
      )}

      {/* results */}
      {search.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
              <Skeleton className="mt-5 h-8 w-2/3" />
            </Card>
          ))}
        </div>
      ) : search.error ? (
        <ErrorState error={search.error} onRetry={() => search.refetch()} />
      ) : (search.data?.items?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Radar className="h-6 w-6" />}
          title="No roles matched"
          description={
            queryParams.q
              ? `Nothing for “${queryParams.q}” under these filters. Try dropping a filter, or pitch the company anyway from /capture.`
              : "Hit Refresh to aggregate the free sources (Arbeitnow · Remotive · RemoteOK · HN · Greenhouse · Lever · Ashby), or paste a posting URL in Quick capture."
          }
          action={
            <Button variant="azure" onClick={() => router.push("/capture")}>
              Capture a posting instead
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {search.data!.items.map((job, i) => (
              <div key={job.id} className="animate-stagger" style={{ ["--i" as any]: Math.min(i, 8) }}>
                <JobCard job={job} onOpen={() => router.push(`/jobs/${job.id}`)} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button size="sm" variant="outline" disabled={Number(queryParams.page) <= 1} onClick={() => patch({ page: String(Number(queryParams.page) - 1) })}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              page {search.data!.pagination.page} / {search.data!.pagination.total_pages}
            </span>
            <Button size="sm" variant="outline" disabled={Number(queryParams.page) >= search.data!.pagination.total_pages} onClick={() => patch({ page: String(Number(queryParams.page) + 1) })}>
              Next
            </Button>
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
}
