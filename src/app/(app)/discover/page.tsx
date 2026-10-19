"use client";

/** Discover (§25.1): sticky query bar, 300ms debounce, URL as source of truth, facets, radar sweep, partial results. */
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Briefcase, Building2, Mail, Radar, RefreshCw, Search, SlidersHorizontal, Users } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { SearchResponse } from "@/types";
import { JobCard } from "@/features/jobs/job-card";
import { PitchTargets } from "@/features/jobs/pitch-targets";
import { EmailJobs } from "@/features/jobs/email-jobs";
import { PeopleDirectory } from "@/features/network/people-directory";
import { Card, Button, Input, Skeleton, Kbd } from "@/components/ui/base";
import { EmptyState, ErrorState, InlineBanner } from "@/components/ui/feedback";
import { InfoButton } from "@/components/ui/modal";
import { Chip } from "@/components/ui/display";
import { SegmentedControl } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

function useDebouncedCallback<T extends (...args: never[]) => void>(fn: T, delay: number) {
  const t = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ref = React.useRef(fn);
  // latest-ref pattern: write in an effect, never during render (react-hooks/refs)
  React.useEffect(() => {
    ref.current = fn;
  }, [fn]);
  // never let a pending keystroke fire a navigation after unmount
  React.useEffect(() => () => clearTimeout(t.current), []);
  return React.useCallback(
    (...args: Parameters<T>) => {
      clearTimeout(t.current);
      t.current = setTimeout(() => ref.current(...args), delay);
    },
    [delay]
  );
}

export default function DiscoverPage() {
  return (
    <React.Suspense fallback={null}>
      <DiscoverPageInner />
    </React.Suspense>
  );
}

/** Every source the chips can show: the configured crawlers plus whatever the result facets report. */
function useSourceChips(
  configured: { name: string; last_error?: string | null; last_run_at?: string | null; items_found?: number | null }[] | undefined,
  facets: Record<string, number>
) {
  return React.useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    const add = (name: string) => {
      if (seen.has(name)) return;
      seen.add(name);
      names.push(name);
    };
    for (const s of configured ?? []) add(s.name);
    for (const name of Object.keys(facets)) add(name);
    return names.map((name) => {
      const meta = configured?.find((s) => s.name === name);
      const count = facets[name];
      return {
        name,
        meta,
        // results in the current search beat "how many this source ever indexed"
        label: count !== undefined ? ` · ${count}` : meta?.last_run_at ? ` · ${meta.items_found ?? 0}` : " · idle",
      };
    });
  }, [configured, facets]);
}

function DiscoverPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const qParam = params.get("q") ?? "";
  const [text, setText] = React.useState(qParam);
  const [showFilters, setShowFilters] = React.useState(false);
  // `social` was the old name for apply-by-email; keep the deep links working
  const rawMode = params.get("mode") ?? "jobs";
  const requested = rawMode === "social" ? "email" : rawMode;
  const mode: "jobs" | "pitch" | "email" | "people" = (["jobs", "pitch", "email", "people"] as const).includes(requested as never)
    ? (requested as "jobs" | "pitch" | "email" | "people")
    : "jobs";

  const inputRef = React.useRef<HTMLInputElement>(null);

  // The URL is the source of truth: quick-filter chips, reset and history navigation all
  // change `q` without going through the input. Sync back down unless the user is typing —
  // otherwise a chip click leaves the box showing the old query.
  React.useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setText(qParam);
  }, [qParam]);

  // Autofocus is a desktop nicety; on a phone it opens the keyboard over half the results.
  React.useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus({ preventScroll: true });
  }, []);

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
    queryFn: () => appFetch("/jobs/search", { params: queryParams, _auth: true }),
    placeholderData: keepPreviousData, // no flash between keystrokes (§34.5)
    staleTime: 30_000,
  });

  const sources = useQuery({
    queryKey: ["jobs", "sources"],
    queryFn: () => appFetch<{ items: { name: string; last_error?: string | null; last_run_at?: string | null; items_found?: number | null }[] }>("/jobs/sources", { _auth: true }),
    staleTime: 60_000,
  });

  // stable identity so the chip memo does not rebuild on every render
  const facetSource = React.useMemo(() => search.data?.facets?.source ?? {}, [search.data]);
  const sourceChips = useSourceChips(sources.data?.items, facetSource);
  const activeFilters = Object.entries(queryParams).filter(([k, v]) => v && k !== "page" && k !== "page_size");
  const failed = search.data?.sources_failed ?? [];

  // Refresh drives its own spinner: `search.isFetching` is also true on every keystroke
  // (placeholderData keeps the old page while the new one loads), which made the icon spin
  // while typing and then go quiet during the real re-index.
  const [refreshing, setRefreshing] = React.useState(false);
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(refreshTimer.current), []);
  const runRefresh = async () => {
    try {
      await appFetch("/jobs/refresh", { method: "POST", body: {}, _auth: true });
      setRefreshing(true);
      toast("Aggregating free sources…", "info");
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        setRefreshing(false);
        void search.refetch();
        void sources.refetch(); // chip counters (last run · items found) are stale after a crawl
      }, 6000);
    } catch {
      toast("Refresh failed", "error");
    }
  };

  return (
    <div className="space-y-5">
      {/* mode tabs: jobs (free boards) · pitch targets (companies with no opening) ·
          apply by email. Labels shorten under sm — three equal segments carrying
          "Pitch targets" and "Apply by email" overflow a 342px track and push the
          travelling indicator off its own label. */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          className="max-w-full sm:max-w-none"
          ariaLabel="Discover mode"
          value={mode}
          onChange={(m) => patch({ mode: m === "jobs" ? undefined : m })}
          options={[
            {
              value: "jobs" as const,
              label: (
                <>
                  <Briefcase className="h-3.5 w-3.5 shrink-0" /> Jobs
                </>
              ),
            },
            {
              value: "pitch" as const,
              label: (
                <>
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Pitch targets</span>
                  <span className="sm:hidden">Pitch</span>
                </>
              ),
            },
            {
              value: "email" as const,
              label: (
                <>
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Apply by email</span>
                  <span className="sm:hidden">Email</span>
                </>
              ),
            },
            {
              value: "people" as const,
              label: (
                <>
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">People</span>
                  <span className="sm:hidden">People</span>
                </>
              ),
            },
          ]}
        />
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
                <b>Apply by email</b> lists only the postings that publish an address (including the HN “Who is hiring” thread), so you can send your
                application straight to a person.
              </p>
              <p>
                <b>People</b> is the other direction: cards posted by people and companies on JAMS, with what they offer, how to reach them, and
                public resumes other members can rate and review.
              </p>
            </>
          }
        />
      </div>

      {mode === "pitch" && <PitchTargets />}
      {mode === "email" && <EmailJobs />}
      {mode === "people" && <PeopleDirectory />}
      {mode === "jobs" && (
        <>
      {/* Query bar: only the input row sticks. The chip rows below used to travel with it and
          ate more than half of a phone viewport once they wrapped. */}
      <div className="glass-sheet sticky top-20 z-20 rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                pushText(e.target.value);
              }}
              placeholder="python · react · payments…   (try: react remote)"
              aria-label="Search jobs"
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setShowFilters((v) => !v)}
            title="Filters"
            aria-label="Filters"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="azure" className="shrink-0 px-3 sm:px-4" onClick={runRefresh} aria-label="Refresh sources">
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* filters panel lives OUTSIDE the sticky bar: pinned open it measured 235px on a
          812px phone viewport and hid the results the user was filtering. */}
      {showFilters && (
        <div className="glass-sheet route-fade rounded-2xl p-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <label className="min-w-0 text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">Location</span>
              {/* keyed on the URL so a chip or reset outside this panel re-syncs the field */}
              <Input key={queryParams.location ?? ""} defaultValue={queryParams.location ?? ""} onBlur={(e) => patch({ location: e.target.value })} placeholder="Remote, Lagos, Berlin…" />
            </label>
            <div className="min-w-0 text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">Remote only</span>
              <SegmentedControl
                ariaLabel="Remote only"
                size="sm"
                stretch
                value={queryParams.remote === "true" ? "yes" : "any"}
                onChange={(v) => patch({ remote: v === "yes" ? "true" : undefined })}
                options={[
                  { value: "any" as const, label: "Any" },
                  { value: "yes" as const, label: "Remote" },
                ]}
              />
            </div>
            <div className="min-w-0 text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">Seniority</span>
              <div className="flex flex-wrap gap-1">
                {["junior", "mid", "senior", "staff"].map((s) => (
                  <Chip key={s} active={queryParams.seniority === s} onClick={() => patch({ seniority: queryParams.seniority === s ? undefined : s })}>
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="min-w-0 text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">Sort</span>
              <SegmentedControl
                ariaLabel="Sort order"
                size="sm"
                stretch
                value={queryParams.sort === "recent" ? "recent" : "score"}
                onChange={(v) => patch({ sort: v === "recent" ? "recent" : undefined })}
                options={[
                  { value: "score" as const, label: "Score" },
                  { value: "recent" as const, label: "Newest" },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* facets + quick filters: scrolls away so the sticky bar stays one row tall */}
      <div className="glass-sheet rounded-2xl p-3">
        {/* source chips (progressive rendering signal, §25.1) — one row, facet counts folded in */}
        <div className="flex flex-wrap items-center gap-1.5">
          {sourceChips.map(({ name, meta, label }) => (
            <Chip
              key={name}
              active={queryParams.source === name}
              onClick={() => patch({ source: queryParams.source === name ? undefined : name })}
              className={cn(!queryParams.source && meta?.last_error && "border-ink/40 text-foreground")}
              title={meta?.last_error ?? `last run ${meta?.last_run_at ?? "never"} · ${meta?.items_found ?? 0} items`}
            >
              {name}
              {label}
            </Chip>
          ))}
          <span className="w-full text-[11px] text-muted-foreground sm:ml-auto sm:w-auto">
            {search.data ? `${search.data.pagination.total_count} results in ${search.data.took_ms}ms` : "searching…"}{" "}
            {activeFilters.length > 0 && `· ${activeFilters.length} filters`}
            {activeFilters.length > 0 && (
              <button className="ml-2 font-semibold text-accent" onClick={() => router.replace("/discover")}>
                reset
              </button>
            )}
          </span>
        </div>

        {/* Nigeria quick filters: the search scope, one click away */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 text-[11px] text-muted-foreground">Nigeria:</span>
          {["Lagos", "Abuja", "Ogun", "Nigeria"].map((loc) => {
            const active = (queryParams.location ?? "").toLowerCase() === loc.toLowerCase();
            return (
              <Chip key={loc} active={active} onClick={() => patch({ location: active ? undefined : loc })}>
                {loc}
              </Chip>
            );
          })}
          <span className="ml-1 shrink-0 text-[11px] text-muted-foreground">role:</span>
          {["software engineer", "frontend", "backend", "full stack", "devops"].map((term) => {
            const active = (queryParams.q ?? "").toLowerCase() === term;
            return (
              <Chip key={term} active={active} onClick={() => patch({ q: active ? undefined : term })}>
                {term}
              </Chip>
            );
          })}
        </div>
      </div>

      {failed.length > 0 && (
        <InlineBanner tone="warn" title="Partial results">
          {failed.map((s) => s.source).join(", ")} didn’t respond, the rest of your results are complete.{" "}
          <Kbd className="ml-1">live sources retry on refresh</Kbd>
        </InlineBanner>
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
              <div key={job.id} className="animate-stagger" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
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
