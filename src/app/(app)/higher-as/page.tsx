"use client";

/**
 * Higher As: a feed of skilled professionals, not a directory dump.
 *
 * Every card answers the same four questions in order: who is this, what have
 * they actually done, what has JAMS checked, and what do customers say. The
 * filters are the ones the data supports - there is no price filter pretending
 * to be comparable when most professionals have not published a rate.
 */
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, HardHat, MapPin, MessageCircle, Search, ShieldCheck, SlidersHorizontal, Sparkles, Wrench, X } from "lucide-react";
import { appFetch } from "@/lib/api";
import type { FeedResponse, ProSummary } from "@/features/higher-as/types";
import { Badge, Button, Card, Chip, Input, Label, Select, Skeleton } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { AutoSummary, ContactDialog, dayRate, RatingSummary, ShareButton } from "@/features/higher-as/ui";
import { cn, fmt } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function HigherAsPage() {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [q, setQ] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const [city, setCity] = React.useState("");
  const [verified, setVerified] = React.useState(false);
  const [available, setAvailable] = React.useState(false);
  const [minRating, setMinRating] = React.useState("");
  const [sort, setSort] = React.useState("relevance");
  const [savedOnly, setSavedOnly] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [contactFor, setContactFor] = React.useState<{ id: string; name: string } | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const params = {
    q: q || undefined,
    trade: trade || undefined,
    city: city || undefined,
    verified: verified ? "true" : undefined,
    available: available ? "true" : undefined,
    min_rating: minRating || undefined,
    sort: sort === "relevance" ? undefined : sort,
    saved: savedOnly ? "true" : undefined,
  };

  const feed = useQuery<FeedResponse>({
    queryKey: ["higher-as", "feed", params],
    queryFn: () => appFetch("/higher-as/feed", { params, _auth: true }),
    staleTime: 30_000,
  });

  const save = useMutation({
    mutationFn: (id: string) => appFetch<{ saved: boolean }>(`/higher-as/pros/${id}/save`, { method: "POST", _auth: true }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Could not save that profile" },
    onSuccess: (res) => toast(res.saved ? "Saved" : "Removed from saved", "success"),
  });

  const active: { label: string; clear: () => void }[] = [
    ...(q ? [{ label: `“${q}”`, clear: () => { setText(""); setQ(""); } }] : []),
    ...(trade ? [{ label: feed.data?.trades.find((t) => t.slug === trade)?.label ?? trade, clear: () => setTrade("") }] : []),
    ...(city ? [{ label: city, clear: () => setCity("") }] : []),
    ...(verified ? [{ label: "verified credentials", clear: () => setVerified(false) }] : []),
    ...(available ? [{ label: "available now", clear: () => setAvailable(false) }] : []),
    ...(minRating ? [{ label: `${minRating}+ rating`, clear: () => setMinRating("") }] : []),
    ...(savedOnly ? [{ label: "saved only", clear: () => setSavedOnly(false) }] : []),
    ...(sort !== "relevance" ? [{ label: `sort: ${sort}`, clear: () => setSort("relevance") }] : []),
  ];

  const reset = () => {
    setText("");
    setQ("");
    setTrade("");
    setCity("");
    setVerified(false);
    setAvailable(false);
    setMinRating("");
    setSort("relevance");
    setSavedOnly(false);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Vocational network"
        icon={<HardHat className="h-3.5 w-3.5" />}
        title="Higher As"
        description="Mechanics, plumbers, electricians, welders and operators, with the work they have shown and the credentials JAMS has actually checked."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => router.push("/higher-as/me")}>
              <Sparkles className="h-3.5 w-3.5" /> My professional profile
            </Button>
            <Button size="sm" variant="azure" onClick={() => router.push("/higher-as/me?new=work")}>
              Post work
            </Button>
          </>
        }
      />

      {/* search + filters */}
      <div className="glass-sheet z-20 rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Trade, name, skill, city…"
              aria-label="Search professionals"
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Filters"
            aria-expanded={showFilters}
            title="Filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="fade-x -mx-1 mt-2 flex snap-x items-center gap-1.5 overflow-x-auto px-1 pb-0.5 no-scrollbar sm:mx-0 sm:px-0">
          <Chip active={!trade && !savedOnly} onClick={() => { setTrade(""); setSavedOnly(false); }}>
            All trades
          </Chip>
          {(feed.data?.trades ?? []).slice(0, 8).map((t) => (
            <Chip key={t.slug} active={trade === t.slug} onClick={() => setTrade(trade === t.slug ? "" : t.slug)}>
              {t.label}
            </Chip>
          ))}
          <Chip active={savedOnly} onClick={() => setSavedOnly((v) => !v)}>
            <Bookmark className="h-3 w-3" /> Saved
          </Chip>
          <span className="ml-2 shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
            {feed.data ? `${feed.data.total} professional${feed.data.total === 1 ? "" : "s"}` : "loading…"}
          </span>
        </div>

        {showFilters && (
          <div className="mt-2 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <Label>City or coverage</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lagos, Abuja, Port Harcourt…" aria-label="City or coverage" />
            </div>
            <div className="min-w-0">
              <Label>Minimum rating</Label>
              <Select value={minRating} onChange={(e) => setMinRating(e.target.value)} aria-label="Minimum rating">
                <option value="">Any rating</option>
                <option value="3">3 stars and up</option>
                <option value="4">4 stars and up</option>
                <option value="4.5">4.5 stars and up</option>
              </Select>
            </div>
            <div className="min-w-0">
              <Label>Sort</Label>
              <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort professionals">
                <option value="relevance">Relevance</option>
                <option value="rating">Rating</option>
                <option value="recent">Most recent work</option>
                <option value="experience">Experience</option>
              </Select>
            </div>
            <div className="min-w-0">
              <Label>Evidence</Label>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={verified} onClick={() => setVerified((v) => !v)}>
                  <ShieldCheck className="h-3 w-3" /> Verified credential
                </Chip>
                <Chip active={available} onClick={() => setAvailable((v) => !v)}>
                  Available now
                </Chip>
              </div>
            </div>
          </div>
        )}

        {active.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
            <span className="text-[11px] text-muted-foreground">Showing:</span>
            {active.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.clear}
                className="inline-flex items-center gap-1 rounded-full border border-ember/35 bg-ember/10 px-2 py-0.5 text-[11px] font-medium text-ember-ink dark:text-ember-soft"
              >
                {a.label} <X className="h-3 w-3" />
              </button>
            ))}
            <button type="button" onClick={reset} className="ml-1 text-[11px] font-semibold text-accent hover:underline">
              clear all
            </button>
          </div>
        )}
      </div>

      {feed.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : feed.error ? (
        <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
      ) : (feed.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title={active.length ? "No professionals under those filters" : "No professionals here yet"}
          description={
            active.length
              ? "Clear a filter to widen the search. Ratings and verification are only shown when there is evidence behind them."
              : "Higher As is built from real profiles. If you work a trade, publish yours: your work, your credentials and your service area are what customers search."
          }
          action={
            active.length ? (
              <Button variant="outline" onClick={reset}>
                Clear filters
              </Button>
            ) : (
              <Button variant="azure" onClick={() => router.push("/higher-as/me")}>
                Create a professional profile
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {feed.data!.items.map((pro, i) => (
            <ProCard
              key={pro.id}
              pro={pro}
              index={i}
              onSave={() => save.mutate(pro.id)}
              saving={save.isPending && save.variables === pro.id}
              onContact={() => setContactFor({ id: pro.id, name: pro.display_name })}
            />
          ))}
        </div>
      )}

      {contactFor && <ContactDialog proId={contactFor.id} name={contactFor.name} open onClose={() => setContactFor(null)} />}
    </PageShell>
  );
}

function ProCard({
  pro,
  index,
  onSave,
  saving,
  onContact,
}: {
  pro: ProSummary;
  index: number;
  onSave: () => void;
  saving: boolean;
  onContact: () => void;
}) {
  const post = pro.latest_post;
  const rate = dayRate(pro.day_rate_min, pro.day_rate_max, pro.currency);
  const initials = pro.display_name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Card className="animate-stagger flex flex-col overflow-hidden" style={{ "--i": Math.min(index, 8) } as React.CSSProperties}>
      {post?.image_url ? (
        <div
          className="h-40 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${post.image_url})` }}
          role="img"
          aria-label={`Work sample from ${pro.display_name}: ${post.title}`}
        />
      ) : (
        <div className="relative flex h-24 items-center gap-3 overflow-hidden border-b border-border bg-[radial-gradient(120%_120%_at_0%_0%,hsl(var(--ember)/0.16),transparent_60%)] px-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-background font-display text-sm font-extrabold">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold">{pro.display_name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {pro.trade_label}
              {pro.city ? ` · ${pro.city}` : ""}
            </p>
          </div>
          {pro.available && <Badge tone="mint" className="absolute right-3 top-3">available</Badge>}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {post?.image_url && (
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border bg-muted font-display text-[10px] font-extrabold">{initials}</span>
            <div className="min-w-0 flex-1">
              <Link href={`/higher-as/${pro.id}`} className="block truncate text-sm font-bold hover:text-accent">
                {pro.display_name}
              </Link>
              <p className="truncate text-[11px] text-muted-foreground">
                {pro.trade_label}
                {pro.city ? ` · ${pro.city}` : ""}
              </p>
            </div>
            {pro.available && <Badge tone="mint">available</Badge>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <RatingSummary rating={pro.rating} compact />
          {pro.credentials.verified > 0 && (
            <Badge tone="mint" title="A reviewer checked a matching document.">
              <ShieldCheck className="h-3 w-3" /> {pro.credentials.verified} verified
            </Badge>
          )}
          {pro.credentials.pending > 0 && <Badge tone="amber">{pro.credentials.pending} pending</Badge>}
          {pro.years_experience != null && <Badge tone="neutral">{pro.years_experience} yrs</Badge>}
        </div>

        {post ? (
          <>
            <div>
              <p className="font-display text-[15px] font-bold leading-tight">{post.title}</p>
              <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{post.body || pro.headline || pro.summary}</p>
            </div>
            {post.auto_summary && <AutoSummary text={post.auto_summary} />}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {post.tags.slice(0, 4).map((t) => (
                  <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div>
            <p className="font-display text-[15px] font-bold leading-tight">{pro.headline || pro.trade_label}</p>
            <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{pro.summary || "No work posted yet."}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {(pro.city || pro.service_area) && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{pro.service_area || pro.city}</span>
            </span>
          )}
          <span className="font-semibold text-foreground">{rate ?? "Rate on request"}</span>
          {post && <span className="ml-auto">{fmt.ago(post.created_at)}</span>}
        </div>

        {pro.match.reasons.length > 0 && (
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">why this ranks:</span> {pro.match.reasons.join(" · ")}
          </p>
        )}

        <div className="mt-auto flex items-center gap-1.5 border-t border-border pt-3">
          <Button size="sm" variant="azure" className="flex-1" onClick={onContact}>
            <MessageCircle className="h-3.5 w-3.5" /> Contact
          </Button>
          <Link
            href={`/higher-as/${pro.id}`}
            className="inline-flex h-8 items-center rounded-full border border-border px-3 text-[13px] font-medium transition-colors hover:border-ember/50 hover:bg-ember/10"
          >
            Profile
          </Link>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            aria-label={pro.saved ? "Remove from saved" : "Save this professional"}
            aria-pressed={pro.saved}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors",
              pro.saved ? "text-ember-deep dark:text-ember-soft" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {pro.saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
          <ShareButton path={`/higher-as/${pro.id}`} label="" className="h-8 w-8 px-0" />
        </div>
      </div>
    </Card>
  );
}
