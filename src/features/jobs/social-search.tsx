"use client";

/**
 * Social search (§25.4): the feeds have no API, so we hand over the exact query
 * and a ready-to-open search URL per platform, tuned for software engineering
 * roles in Nigeria. Email for pitching comes from capturing any result URL
 * (the capture preview extracts published addresses from the page).
 */
import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Copy, ExternalLink, Info, Search } from "lucide-react";
import { appFetch } from "@/lib/api";
import { Badge, Button, Card, Input } from "@/components/ui/base";
import { ErrorState, InlineBanner } from "@/components/ui/feedback";
import { InfoButton } from "@/components/ui/modal";
import { toast } from "@/hooks/use-toast";

type Recipe = { platform: string; label: string; query: string; url: string; note: string };
type SocialPayload = { platforms: Recipe[]; suggestions: string[]; scope: string; email_hint: string };

export function SocialSearch() {
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const social = useQuery<SocialPayload>({
    queryKey: ["jobs", "social", debouncedQ],
    queryFn: () => appFetch("/jobs/social", { params: debouncedQ ? { q: debouncedQ } : {}, _auth: true }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000,
  });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast("Search query copied", "success");
  };

  return (
    <div className="space-y-4">
      <div className="glass-sheet rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What are you looking for? e.g. react engineer" className="pl-9" />
          </div>
          <InfoButton
            title="Social job search"
            body={
              <>
                <p>
                  Every platform gets a prebuilt search for <b>software engineering roles in Nigeria</b> (Lagos, Abuja, Ogun, nationwide). Click a card to open the search in a new tab; use the copy button to take the query anywhere else.
                </p>
                <p>Found something? Paste the post URL into Capture: it extracts the published email and the preview tells you whether it is a pitch or an application.</p>
              </>
            }
          />
        </div>

        {(social.data?.suggestions?.length ?? 0) > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Try:</span>
            {social.data!.suggestions.map((s) => (
              <button key={s} onClick={() => setQ(s)} className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <InlineBanner tone="info" title="Scope">
        {social.data?.scope ?? "software engineering roles in Nigeria"} · {social.data?.email_hint ?? "Capture any result URL to pull its email for pitching or applying."}
      </InlineBanner>

      {social.isError ? (
        <ErrorState error={social.error} onRetry={() => social.refetch()} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(social.data?.platforms ?? Array.from({ length: 6 }).map(() => null)).map((r, i) =>
            r ? (
              <Card key={r.platform} className="animate-stagger flex flex-col gap-2.5 p-4" style={{ ["--i" as any]: Math.min(i, 8) }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-bold">{r.label}</p>
                  <Badge tone="azure">live search</Badge>
                </div>
                <button onClick={() => copy(r.query)} className="rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-left font-mono text-[11px] leading-relaxed hover:border-foreground/30" title="Click to copy the query">
                  {r.query}
                </button>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{r.note}</p>
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <a href={r.url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="azure">
                      <ExternalLink className="h-3.5 w-3.5" /> Open search
                    </Button>
                  </a>
                  <Button size="sm" variant="outline" onClick={() => copy(r.query)}>
                    <Copy className="h-3.5 w-3.5" /> Copy query
                  </Button>
                </div>
              </Card>
            ) : (
              <Card key={i} className="h-44 p-4">
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="mt-3 h-16 w-full rounded bg-muted" />
              </Card>
            )
          )}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5" /> Social results are not scraped: you open the search, then bring anything promising back through Capture so it is tracked like every other application.
      </p>
    </div>
  );
}
