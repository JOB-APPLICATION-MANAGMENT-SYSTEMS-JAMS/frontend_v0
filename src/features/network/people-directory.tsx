"use client";

/**
 * Discover → People.
 *
 * The other half of Discover: jobs are things you apply to, people are things you
 * join. This is a directory with a point of view — every card carries the reasons
 * it ranked where it did (same profession, shared skills, same city), because a
 * feed that cannot explain itself is just a list.
 *
 * The loop the page closes:
 *   post yourself (guided questions + social links)
 *   → publish a resume from Resume Studio
 *   → other people and hirers leave a rating and a review on it
 *   → the rating travels back to Resume Studio.
 *
 * Everything is one screen on a phone: filters scroll sideways, cards stack, and
 * both dialogs are `max-h-[calc(100dvh-2rem)]` with their own scroll.
 */
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Eye,
  EyeOff,
  Globe2,
  MapPin,
  Pencil,
  Plus,
  Quote,
  Search,
  Send,
  Star,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { CvReviews, PeopleResponse, Person } from "@/types";
import { Badge, Button, Card, Chip, Input, Label, Select, Skeleton, Textarea } from "@/components/ui/base";
import { EmptyState, ErrorState, InlineBanner } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { Stars } from "@/components/ui/stars";
import { toast } from "@/hooks/use-toast";
import { fmt } from "@/lib/utils";

const LINK_KEYS = ["linkedin", "github", "x", "instagram", "website"] as const;
const LINK_LABEL: Record<string, string> = { linkedin: "LinkedIn", github: "GitHub", x: "X", instagram: "Instagram", website: "Website" };
const OPEN_TO = ["full-time", "contract", "freelance", "mentorship", "collaboration", "hiring"];

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function PeopleDirectory() {
  const [text, setText] = React.useState("");
  const [q, setQ] = React.useState("");
  const [profession, setProfession] = React.useState("");
  const [city, setCity] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);

  // 300ms, same as the job search — one debounce rhythm in the product
  React.useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const params = { q: q || undefined, profession: profession || undefined, location: city || undefined };
  const people = useQuery<PeopleResponse>({
    queryKey: qk.peopleList(params),
    queryFn: () => appFetch("/people", { params, _auth: true }),
    staleTime: 30_000,
  });

  const me = people.data?.me ?? null;
  const professions = Object.entries(people.data?.facets.profession ?? {})
    .filter(([k]) => k && k !== "—")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const cities = Object.entries(people.data?.facets.location ?? {})
    .filter(([k]) => k && k !== "—")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const filtered = !!(profession || city || q);

  return (
    <div className="space-y-4">
      {/* intent + the one primary action */}
      <div className="glass-sheet flex flex-wrap items-center gap-3 rounded-2xl p-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {people.data ? `${people.data.total} people on the network` : "Loading the network…"}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            People and companies, what they offer and what they are looking for. Ranked against your profession, skills and city.
          </p>
        </div>
        {/* on a phone the button takes its own row: sharing 327px with four lines
            of copy made both halves cramped */}
        <Button size="sm" variant="azure" className="shrink-0 max-sm:w-full" onClick={() => setEditing(true)}>
          {me ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {me ? "Edit my card" : "Post yourself"}
        </Button>
      </div>

      {/* search + filters: chips scroll sideways instead of wrapping into a wall */}
      <div className="glass-sheet space-y-2 rounded-2xl p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Name, skill, company, “offers design systems”…"
            aria-label="Search people"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Field</span>
          {professions.length === 0 && <span className="text-[11px] text-muted-foreground">no roles yet</span>}
          {professions.map(([name, n]) => (
            <Chip key={name} active={profession === name} onClick={() => setProfession(profession === name ? "" : name)}>
              {name} <span className="opacity-60">{n}</span>
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">City</span>
          {cities.map(([name, n]) => (
            <Chip key={name} active={city === name} onClick={() => setCity(city === name ? "" : name)}>
              {name} <span className="opacity-60">{n}</span>
            </Chip>
          ))}
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setText("");
                setQ("");
                setProfession("");
                setCity("");
              }}
              className="ml-auto shrink-0 text-[11px] font-semibold text-accent hover:underline"
            >
              reset
            </button>
          )}
        </div>
      </div>

      {people.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      ) : people.error ? (
        <ErrorState error={people.error} onRetry={() => people.refetch()} />
      ) : (people.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={filtered ? "Nobody matched those filters" : "The network is empty"}
          description={
            filtered
              ? "Drop a chip, or search for a skill instead of a title."
              : "Be the first card: say what you do, what you offer and how to reach you. Five short questions, no CV required."
          }
          action={
            <Button variant="azure" onClick={() => setEditing(true)}>
              <Plus className="h-4 w-4" /> Post yourself
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {people.data!.items.map((p, i) => (
            <PersonCard key={p.id} person={p} onOpen={() => setOpenId(p.id)} index={i} />
          ))}
        </div>
      )}

      {people.data && !people.data.viewer.has_profile && (
        <InlineBanner tone="info" title="A card makes the rest work">
          Your reviews, your public resume and your offers all hang off a public card. It takes about two minutes, and you can hide it any time.
        </InlineBanner>
      )}

      <PersonDialog personId={openId} onClose={() => setOpenId(null)} />
      {/* Mounted on open, not on page load: the form seeds from the card that
          exists at that moment, so a late fetch cannot leave it half-empty. */}
      {editing && (
        <PersonForm
          open
          onClose={() => setEditing(false)}
          me={me}
          questions={people.data?.questions ?? []}
          defaultName={people.data?.viewer.name ?? ""}
          defaultCity={people.data?.viewer.city ?? ""}
          defaultHeadline={people.data?.viewer.headline ?? ""}
          defaultProfession={people.data?.viewer.profession ?? ""}
        />
      )}
    </div>
  );
}

function PersonCard({ person, onOpen, index }: { person: Person; onOpen: () => void; index: number }) {
  const links = Object.entries(person.links ?? {}).filter(([, v]) => !!v);
  return (
    <Card className="animate-stagger flex flex-col p-4" style={{ "--i": Math.min(index, 8) } as React.CSSProperties}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[image:var(--gradient-brand)] font-display text-sm font-extrabold text-primary-foreground">
          {initials(person.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-display text-base font-bold">
            {person.name}
            {person.match && person.match.score >= 60 && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-ember" aria-label="Strong match" />}
          </p>
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{person.headline || person.profession || "No headline yet"}</p>
        </div>
        {person.cv?.rating && (
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <Stars value={person.cv.rating.avg} size={11} />
            <span className="text-[10px] text-muted-foreground">
              {person.cv.rating.avg} · {person.cv.rating.count}
            </span>
          </span>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {person.profession && <Badge tone="azure">{person.profession}</Badge>}
        {person.location && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {person.location}
          </span>
        )}
      </div>

      {person.match && person.match.reasons.length > 0 && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">why you see this:</span> {person.match.reasons.join(" · ")}
        </p>
      )}

      {person.offers.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {person.offers.slice(0, 3).map((o) => (
            <span key={o} className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {o}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-1.5 pt-3">
        {links.slice(0, 3).map(([k, v]) => (
          <a
            key={k}
            href={v}
            target="_blank"
            rel="noreferrer"
            className="touch-slop inline-flex h-7 items-center rounded-lg border border-border px-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-ember/50 hover:text-foreground"
          >
            {LINK_LABEL[k] ?? k}
          </a>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={onOpen}>
          <Eye className="h-3.5 w-3.5" /> View{person.cv ? " & review" : ""}
        </Button>
      </div>
    </Card>
  );
}

/* ─────────────────────────── person + reviews ────────────────────────── */

function PersonDialog({ personId, onClose }: { personId: string | null; onClose: () => void }) {
  const detail = useQuery<Person>({
    queryKey: qk.person(personId ?? ""),
    queryFn: () => appFetch(`/people/${personId}`, { _auth: true }),
    enabled: !!personId,
  });

  return (
    <Modal open={!!personId} onClose={onClose} label="Person" className="max-w-2xl">
      {detail.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : detail.error ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : detail.data ? (
        <PersonBody person={detail.data} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

function PersonBody({ person, onClose }: { person: Person; onClose: () => void }) {
  const links = Object.entries(person.links ?? {}).filter(([, v]) => !!v);
  const publicCvs = (person.cvs ?? []).filter((c) => c.public);
  const [cvId, setCvId] = React.useState(publicCvs[0]?.id ?? "");
  const [rating, setRating] = React.useState(0);
  const [relationship, setRelationship] = React.useState("peer");
  const [body, setBody] = React.useState("");

  const review = useMutation({
    mutationFn: () =>
      appFetch<CvReviews>(`/cvs/${cvId}/reviews`, {
        method: "POST",
        body: { rating, body, relationship },
        _auth: true,
      }),
    meta: { invalidates: [["people"], ["cvs", "reviews", cvId], ["people", "public-cvs"]], errorFallback: "Review not saved" },
    onSuccess: () => {
      toast("Review posted — thanks for being specific", "success");
      setRating(0);
      setBody("");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[image:var(--gradient-brand)] font-display text-base font-extrabold text-primary-foreground">
          {initials(person.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight">{person.name}</p>
          <p className="text-sm text-muted-foreground">{person.headline || person.profession}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {person.profession && <Badge tone="azure">{person.profession}</Badge>}
            {person.seniority && <Badge>{person.seniority}</Badge>}
            {person.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {person.location}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {person.bio && <p className="text-sm leading-relaxed">{person.bio}</p>}

      {person.looking_for && (
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="eyebrow mb-1">Looking for</p>
          <p className="text-sm">{person.looking_for}</p>
        </div>
      )}

      {person.offers.length > 0 && (
        <div>
          <p className="eyebrow mb-1.5">Can help with</p>
          <div className="flex flex-wrap gap-1.5">
            {person.offers.map((o) => (
              <Badge key={o} tone="mint">
                {o}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {person.answers.length > 0 && (
        <div className="space-y-2.5">
          <p className="eyebrow">In their words</p>
          {person.answers
            .filter((a) => a.a?.trim())
            .map((a) => (
              <div key={a.q} className="rounded-xl border border-border p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{a.q}</p>
                <p className="mt-1 flex gap-1.5 text-sm leading-relaxed">
                  <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember/70" />
                  <span>{a.a}</span>
                </p>
              </div>
            ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {links.map(([k, v]) => (
            <a
              key={k}
              href={v}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-ember/50 hover:bg-ember/10"
            >
              <Globe2 className="h-3 w-3" /> {LINK_LABEL[k] ?? k}
            </a>
          ))}
        </div>
      )}

      {/* reviews */}
      <div className="border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5" /> Resume reviews
          </p>
          {publicCvs.length > 0 && publicCvs[0].reviews.avg != null && (
            <span className="flex items-center gap-1.5 text-xs">
              <Stars value={publicCvs[0].reviews.avg} size={12} />
              <span className="font-semibold">{publicCvs[0].reviews.avg}</span>
              <span className="text-muted-foreground">({publicCvs[0].reviews.count})</span>
            </span>
          )}
        </div>

        {publicCvs.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            They have not published a resume yet, so there is nothing to review. Reviews open up when a resume is made public in Resume Studio.
          </p>
        ) : (
          <>
            <ul className="mt-2 space-y-2">
              {(person.reviews ?? []).map((r) => (
                <li key={r.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} size={11} />
                    <span className="text-xs font-semibold">{r.reviewer_name}</span>
                    <Badge tone="neutral" className="capitalize">
                      {r.relationship}
                    </Badge>
                    <span className="ml-auto text-[10px] text-muted-foreground">{fmt.ago(r.created_at)}</span>
                  </div>
                  {r.reviewer_role && <p className="mt-0.5 text-[10px] text-muted-foreground">{r.reviewer_role}</p>}
                  <p className="mt-1.5 text-sm leading-relaxed">{r.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">on “{r.cv_name}”</p>
                </li>
              ))}
              {(person.reviews ?? []).length === 0 && <li className="text-xs text-muted-foreground">No reviews yet — yours would be the first.</li>}
            </ul>

            {!person.is_me && (
              <div className="mt-3 rounded-xl border border-border p-3">
                <p className="text-xs font-semibold">Leave a review on their resume</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  What would you change before this person sends it? Be specific, the score alone is not useful.
                </p>
                {publicCvs.length > 1 && (
                  <div className="mt-2">
                    <Label>Resume</Label>
                    <Select value={cvId} onChange={(e) => setCvId(e.target.value)}>
                      {publicCvs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Stars value={rating} onChange={setRating} size={18} label="Your rating" />
                  <Select value={relationship} onChange={(e) => setRelationship(e.target.value)} className="h-8 w-auto text-xs">
                    <option value="hirer">I hire</option>
                    <option value="recruiter">I recruit</option>
                    <option value="mentor">I mentor</option>
                    <option value="peer">Peer</option>
                  </Select>
                </div>
                <Textarea
                  className="mt-2 min-h-[72px]"
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="The summary buries the strongest number. Lead the first bullet with the 40% latency win…"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">{body.trim().length}/10 characters minimum</span>
                  <Button size="sm" variant="azure" onClick={() => review.mutate()} disabled={review.isPending || rating === 0 || body.trim().length < 10}>
                    <Send className="h-3.5 w-3.5" /> {review.isPending ? "Posting…" : "Post review"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── the form ──────────────────────────────── */

function PersonForm({
  open,
  onClose,
  me,
  questions,
  defaultName,
  defaultCity,
  defaultHeadline,
  defaultProfession,
}: {
  open: boolean;
  onClose: () => void;
  me: Person | null;
  questions: { key: string; q: string; hint: string }[];
  defaultName: string;
  defaultCity: string;
  defaultHeadline: string;
  defaultProfession: string;
}) {
  const [name, setName] = React.useState(me?.name ?? defaultName);
  const [headline, setHeadline] = React.useState(me?.headline ?? defaultHeadline);
  const [profession, setProfession] = React.useState(me?.profession ?? defaultProfession);
  const [seniority, setSeniority] = React.useState(me?.seniority ?? "");
  const [location, setLocation] = React.useState(me?.location ?? defaultCity);
  const [bio, setBio] = React.useState(me?.bio ?? "");
  const [offers, setOffers] = React.useState((me?.offers ?? []).join(", "));
  const [lookingFor, setLookingFor] = React.useState(me?.looking_for ?? "");
  const [openTo, setOpenTo] = React.useState<string[]>(me?.open_to ?? []);
  const [links, setLinks] = React.useState<Record<string, string>>(me?.links ?? {});
  const [answers, setAnswers] = React.useState<Record<string, string>>(
    Object.fromEntries((me?.answers ?? []).map((a) => [a.q, a.a]))
  );
  const [visible, setVisible] = React.useState(me ? me.visible : true);

  const save = useMutation({
    mutationFn: () =>
      appFetch("/people/me", {
        method: "PUT",
        body: {
          name: name.trim() || undefined,
          headline: headline.trim(),
          profession: profession.trim(),
          seniority: seniority.trim(),
          location: location.trim(),
          bio: bio.trim(),
          offers: offers
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 12),
          looking_for: lookingFor.trim(),
          open_to: openTo,
          // only answers the person actually wrote: an empty prompt is not data
          answers: questions.map((q) => ({ q: q.q, a: (answers[q.q] ?? "").trim() })).filter((a) => a.a),
          links: Object.fromEntries(Object.entries(links).filter(([, v]) => v.trim())),
          visible,
        },
        _auth: true,
      }),
    meta: { invalidates: [["people"], ["profile"], ["profile", "completeness"]], errorFallback: "Card not saved" },
    onSuccess: () => {
      toast(me ? "Card updated" : "You are on the network", "success");
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} label={me ? "Edit your card" : "Post yourself"} className="max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold">{me ? "Edit your card" : "Post yourself"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Five answers and a couple of links is enough. Everything is optional except a name, and you can hide the card at the bottom.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="How you want to be introduced" />
          </div>
          <div>
            <Label>Headline</Label>
            <Input aria-label="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Frontend engineer · design systems" />
          </div>
          <div>
            <Label>Profession</Label>
            <Input aria-label="Profession" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="software engineering" />
          </div>
          <div>
            <Label>Seniority</Label>
            <Input aria-label="Seniority" value={seniority} onChange={(e) => setSeniority(e.target.value)} placeholder="junior · mid · senior · staff" />
          </div>
          <div>
            <Label>Location</Label>
            <Input aria-label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lagos, Nigeria" />
          </div>
          <div>
            <Label>Looking for</Label>
            <Input aria-label="Looking for" value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} placeholder="A mid-level frontend role" />
          </div>
        </div>

        <div>
          <Label>Short bio</Label>
          <Textarea aria-label="Short bio" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Two sentences: what you do, and what you are known for." />
        </div>

        <div>
          <Label>What you offer (comma separated)</Label>
          <Input aria-label="What you offer" value={offers} onChange={(e) => setOffers(e.target.value)} placeholder="React audits, design systems, mentoring" />
        </div>

        <div>
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5" /> The five questions
          </p>
          <div className="space-y-2.5">
            {questions.map((q, i) => (
              <div key={q.key} className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-foreground">
                  {i + 1}. {q.q}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{q.hint}</p>
                <Textarea
                  aria-label={q.q}
                  className="mt-2 min-h-[60px]"
                  rows={2}
                  value={answers[q.q] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.q]: e.target.value }))}
                  placeholder="One or two sentences."
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="eyebrow mb-2">Open to</p>
          <div className="flex flex-wrap gap-1.5">
            {OPEN_TO.map((o) => (
              <Chip
                key={o}
                active={openTo.includes(o)}
                onClick={() => setOpenTo((cur) => (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]))}
              >
                {o}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="eyebrow mb-2">Social links</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {LINK_KEYS.map((k) => (
              <div key={k}>
                <Label>{LINK_LABEL[k]}</Label>
                <Input
                  aria-label={`${LINK_LABEL[k]} URL`}
                  value={links[k] ?? ""}
                  onChange={(e) => setLinks((l) => ({ ...l, [k]: e.target.value }))}
                  placeholder={`https://${k === "website" ? "yoursite.com" : `${k}.com/you`}`}
                  inputMode="url"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
        >
          {visible ? <Eye className="h-4 w-4 text-ember" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{visible ? "Visible on Discover" : "Hidden from Discover"}</span>
            <span className="block text-[10px] text-muted-foreground">Hiding keeps your offer and reviews, nobody new finds you.</span>
          </span>
        </button>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[10px] text-muted-foreground">
            {questions.filter((q) => (answers[q.q] ?? "").trim()).length} of {questions.length} questions answered · {Object.values(links).filter((v) => v.trim()).length} links
          </span>
          <Button variant="azure" onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
            {save.isPending ? "Saving…" : me ? "Save card" : "Publish my card"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
