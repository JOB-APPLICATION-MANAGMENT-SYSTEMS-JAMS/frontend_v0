"use client";

/**
 * Events — hiring fairs, trainings, seminars, community stories, programme ads.
 *
 * Three things make this page different from a noticeboard:
 *  1. It starts where you are: the ranking gives a large weight to the city in
 *     your profile, so the first card is usually a short trip away. The city chip
 *     is one tap for when you want to *restrict* the list instead.
 *  2. Search is expanded, not matched literally: “job fair” finds `hiring`,
 *     “bootcamp” finds `training`, and a query is scored across title, host,
 *     description, tags and venue instead of being a substring test.
 *  3. Every event is actionable without a backend: one tap writes a real `.ics`
 *     file, so it lands in the calendar people actually look at.
 *
 * Listings marked demo are seeded for review; real events would carry `demo: 0`.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Users,
  Video,
  X,
} from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { EventKind, EventListing, EventsResponse } from "@/types";
import { Badge, Button, Card, Chip, Input, Skeleton } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/menu";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<EventKind, string> = {
  hiring: "Hiring",
  training: "Training",
  seminar: "Seminar",
  story: "Story",
  meetup: "Meetup",
  ad: "Programme ad",
};

const KIND_TONE: Record<EventKind, "mint" | "azure" | "orchid" | "amber" | "rose" | "neutral"> = {
  hiring: "azure",
  training: "mint",
  seminar: "amber",
  story: "orchid",
  meetup: "rose",
  ad: "neutral",
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function when(iso: string) {
  const d = new Date(iso);
  return {
    weekday: DAY[d.getDay()],
    day: String(d.getDate()).padStart(2, "0"),
    month: MONTH[d.getMonth()],
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    full: d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
  };
}

function inDays(iso: string) {
  const d = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 7) return `in ${d} days`;
  const w = Math.round(d / 7);
  return `in ${w} week${w === 1 ? "" : "s"}`;
}

/** A real calendar invitation. No server, no account, works in Google/Apple/Outlook. */
function downloadIcs(e: EventListing) {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const end = e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 2 * 3_600_000).toISOString();
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JAMS//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@jams`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.starts_at)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${e.title.replace(/[,;]/g, " ")}`,
    `DESCRIPTION:${e.description.replace(/[,;]/g, " ").slice(0, 500)}`,
    `LOCATION:${[e.venue, e.city, e.country].filter(Boolean).join(", ").replace(/[,;]/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  // Remove and revoke on the next tick, not synchronously: Chromium starts the
  // download after the click returns, and an anchor that is already detached can
  // have its blob URL revoked before the browser reads it.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1500);
}

export default function EventsPage() {
  const [text, setText] = React.useState("");
  const [q, setQ] = React.useState("");
  const [kind, setKind] = React.useState("");
  // null = follow the profile's city, which is what makes the page feel local on
  // first load. A choice (including “All”) pins the filter from then on.
  const [cityChoice, setCityChoice] = React.useState<string | null>(null);
  const [format, setFormat] = React.useState("");
  const [period, setPeriod] = React.useState<"all" | "week" | "month">("all");
  const [showFilters, setShowFilters] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState<string[]>([]);

  React.useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const params = {
    q: q || undefined,
    kind: kind || undefined,
    // The profile city is a *ranking* input (weighted heavily server-side), not a
    // default filter: silently hiding every event outside Lagos is worse than
    // showing Lagos first. The chip is still marked “near you”.
    city: cityChoice || undefined,
    format: format || undefined,
    when: period === "all" ? undefined : period,
  };
  const events = useQuery<EventsResponse>({
    queryKey: qk.eventList(params),
    queryFn: () => appFetch("/events", { params, _auth: true }),
    staleTime: 60_000,
  });

  const near = events.data?.viewer.city ?? "";
  const items = events.data?.items ?? [];
  const featured = items.find((e) => e.featured) ?? null;
  const rest = featured ? items.filter((e) => e.id !== featured.id) : items;
  const cities = Object.entries(events.data?.facets.city ?? {}).sort((a, b) => b[1] - a[1]);
  const kinds = events.data?.kinds ?? (Object.keys(KIND_LABEL) as EventKind[]);
  const filtered = !!(q || kind || cityChoice || format || period !== "all");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Events"
        icon={<CalendarDays className="h-3.5 w-3.5" />}
        title="What's happening near you"
        description="Hiring fairs, trainings, seminars, community stories and programme ads — ranked by your city, your field and what you said you are looking for."
        actions={
          <>
            <Badge tone="mint" className="h-8 px-3">
              <Sparkles className="h-3 w-3" /> {near ? `near ${near}` : "Nigeria first"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
            </Button>
          </>
        }
      />

      {/* search */}
      <div className="glass-sheet sticky top-[68px] z-20 rounded-2xl p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Try “job fair”, “design portfolio”, “remote”, “Abuja”…"
            aria-label="Search events"
            className="pl-9"
          />
        </div>

        {/* kinds: one scrolling row on every width */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <Chip active={!kind} onClick={() => setKind("")}>
            All
          </Chip>
          {kinds.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? "" : k)}>
              {KIND_LABEL[k]}
              {events.data?.facets.kind[k] ? <span className="opacity-60">{events.data.facets.kind[k]}</span> : null}
            </Chip>
          ))}
        </div>

        {/* cities, with “near you” first */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">City</span>
          <Chip active={!cityChoice} onClick={() => setCityChoice("")}>
            All
          </Chip>
          {cities.map(([c, n]) => (
            <Chip key={c} active={cityChoice === c} onClick={() => setCityChoice(cityChoice === c ? "" : c)}>
              {c}
              {near === c && <span className="text-[9px] uppercase tracking-wider">near you</span>}
              <span className="opacity-60">{n}</span>
            </Chip>
          ))}
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setText("");
                setQ("");
                setKind("");
                setCityChoice("");
                setFormat("");
                setPeriod("all");
              }}
              className="ml-auto shrink-0 text-[11px] font-semibold text-accent hover:underline"
            >
              reset
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <SegmentedControl
              ariaLabel="When"
              size="sm"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "all", label: "Any date" },
                { value: "week", label: "This week" },
                { value: "month", label: "This month" },
              ]}
            />
            <div className="flex flex-wrap gap-1.5">
              {["in-person", "virtual", "hybrid"].map((f) => (
                <Chip key={f} active={format === f} onClick={() => setFormat(format === f ? "" : f)}>
                  {f}
                </Chip>
              ))}
            </div>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {events.data ? `${events.data.total} event${events.data.total === 1 ? "" : "s"}` : "searching…"}
            </span>
          </div>
        )}
      </div>

      {events.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : events.error ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title={filtered ? "Nothing matched those filters" : "No events listed yet"}
          description={
            filtered
              ? "Try “job fair”, drop the city, or widen the date range. Search understands hiring, training and seminar as categories, not just words."
              : "Events appear here as hosts post them."
          }
          action={
            filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setText("");
                  setQ("");
                  setKind("");
                  setCityChoice("");
                  setFormat("");
                  setPeriod("all");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {featured && (
            <FeaturedEvent
              event={featured}
              onOpen={() => setOpenId(featured.id)}
              added={added.includes(featured.id)}
              onAdd={() => {
                downloadIcs(featured);
                setAdded((a) => [...a, featured.id]);
              }}
            />
          )}

          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <h2 className="eyebrow">{featured ? "Also happening" : "Happening"}</h2>
            <span className="text-[11px] text-muted-foreground">
              {events.data?.demo ? <><span className="sm:hidden">seeded for review</span><span className="hidden sm:inline">includes seeded events for review</span></> : "live listings"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rest.map((e, i) => (
              <EventCard
                key={e.id}
                event={e}
                index={i}
                onOpen={() => setOpenId(e.id)}
                added={added.includes(e.id)}
                onAdd={() => {
                  downloadIcs(e);
                  setAdded((a) => [...a, e.id]);
                }}
              />
            ))}
          </div>
        </>
      )}

      <EventDialog eventId={openId} items={items} onClose={() => setOpenId(null)} />
    </PageShell>
  );
}

function DateBadge({ iso, big }: { iso: string; big?: boolean }) {
  const d = when(iso);
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl border border-border bg-card/70 text-center",
        big ? "h-16 w-14" : "h-12 w-11"
      )}
      aria-label={d.full}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-ember-deep dark:text-ember-soft">{d.month}</span>
      <span className={cn("tnum font-display font-extrabold leading-none", big ? "text-xl" : "text-base")}>{d.day}</span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{d.weekday}</span>
    </span>
  );
}

function FeaturedEvent({ event, onOpen, added, onAdd }: { event: EventListing; onOpen: () => void; added: boolean; onAdd: () => void }) {
  return (
    <Card className="relative overflow-hidden border-ember/35 p-4 sm:p-5">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-ember/18 blur-2xl" />
      <div className="flex flex-wrap items-start gap-3">
        <DateBadge iso={event.starts_at} big />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="mint">Featured</Badge>
            <Badge tone={KIND_TONE[event.kind]}>{KIND_LABEL[event.kind]}</Badge>
            <span className="text-[11px] text-muted-foreground">{inDays(event.starts_at)}</span>
          </div>
          <h2 className="mt-1 font-display text-lg font-extrabold leading-tight sm:text-xl">{event.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {event.host} · {when(event.starts_at).full}, {when(event.starts_at).time}
          </p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{event.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {event.venue}, {event.city}
        </span>
        <span className="inline-flex items-center gap-1">
          {event.format === "virtual" ? <Video className="h-3 w-3" /> : <Users className="h-3 w-3" />} {event.format}
        </span>
        <span className="inline-flex items-center gap-1">
          <Ticket className="h-3 w-3" /> {event.price || "Free"}
        </span>
        {event.match.reasons.length > 0 && <span className="hidden sm:inline">· {event.match.reasons[0]}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="azure" onClick={onAdd} disabled={added}>
          {added ? <Check className="h-3.5 w-3.5" /> : <CalendarPlus className="h-3.5 w-3.5" />}
          {added ? "In your calendar" : "Add to calendar"}
        </Button>
        <Button size="sm" variant="outline" onClick={onOpen}>
          Details
        </Button>
        {event.url && (
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Register <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </Card>
  );
}

function EventCard({
  event,
  index,
  onOpen,
  added,
  onAdd,
}: {
  event: EventListing;
  index: number;
  onOpen: () => void;
  added: boolean;
  onAdd: () => void;
}) {
  return (
    <Card className="animate-stagger flex flex-col p-4" style={{ "--i": Math.min(index, 8) } as React.CSSProperties}>
      <div className="flex items-start gap-3">
        <DateBadge iso={event.starts_at} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={KIND_TONE[event.kind]}>{KIND_LABEL[event.kind]}</Badge>
            <span className="text-[10px] text-muted-foreground">{inDays(event.starts_at)}</span>
          </div>
          <button type="button" onClick={onOpen} className="mt-1 block text-left">
            <h3 className="line-clamp-2 font-display text-[15px] font-bold leading-snug hover:underline">{event.title}</h3>
          </button>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{event.host}</p>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{event.description}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {event.city}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> {when(event.starts_at).time}
        </span>
        <span className="inline-flex items-center gap-1">
          {event.format === "virtual" ? <Video className="h-3 w-3" /> : <Users className="h-3 w-3" />} {event.format}
        </span>
        <span className="font-semibold text-foreground">{event.price || "Free"}</span>
      </div>

      {event.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {event.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-1.5 border-t border-border pt-3">
        <Button size="sm" variant={added ? "secondary" : "outline"} onClick={onAdd} disabled={added}>
          {added ? <Check className="h-3.5 w-3.5" /> : <CalendarPlus className="h-3.5 w-3.5" />}
          {added ? "Added" : "Calendar"}
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onOpen}>
          Details
        </Button>
      </div>
    </Card>
  );
}

function EventDialog({ eventId, items, onClose }: { eventId: string | null; items: EventListing[]; onClose: () => void }) {
  const event = items.find((e) => e.id === eventId) ?? null;
  return (
    <Modal open={!!event} onClose={onClose} label="Event" className="max-w-lg">
      {event && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <DateBadge iso={event.starts_at} big />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={KIND_TONE[event.kind]}>{KIND_LABEL[event.kind]}</Badge>
                {event.featured && <Badge tone="mint">Featured</Badge>}
              </div>
              <h2 className="mt-1 font-display text-lg font-bold leading-tight">{event.title}</h2>
              <p className="text-xs text-muted-foreground">{event.host}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm leading-relaxed">{event.description}</p>

          <dl className="grid gap-2 rounded-xl border border-border p-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">When</dt>
              <dd className="font-medium">
                {when(event.starts_at).full} · {when(event.starts_at).time}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Where</dt>
              <dd className="font-medium">
                {event.venue}, {event.city}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Format</dt>
              <dd className="font-medium capitalize">{event.format}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Price</dt>
              <dd className="font-medium">{event.price || "Free"}</dd>
            </div>
            {event.seats && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Seats</dt>
                <dd className="font-medium">{event.seats}</dd>
              </div>
            )}
          </dl>

          {event.match.reasons.length > 0 && (
            <p className="text-[11px] leading-snug text-muted-foreground">
              <span className="font-semibold text-foreground">why you see this:</span> {event.match.reasons.join(" · ")}
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button variant="azure" onClick={() => downloadIcs(event)}>
              <CalendarPlus className="h-4 w-4" /> Add to calendar
            </Button>
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-ember/50 hover:bg-ember/10"
              >
                Register <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
