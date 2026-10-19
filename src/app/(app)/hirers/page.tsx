"use client";

/**
 * Hirers — jobs posted *on JAMS*, not aggregated from boards.
 *
 * The difference is the whole page. An aggregated listing is something you apply
 * to elsewhere; a platform listing was written by a person or company here, so it
 * can be ranked against your profile, tracked with one button, and answered with
 * an email address that actually exists.
 *
 * Two product rules live here:
 *   1. Without a profession the page cannot rank anything, so it asks once — right
 *      at the top, with chips — instead of showing a generic wall of jobs.
 *   2. Anyone can post. The form is the same one a company would use; the posting
 *      is marked "by a JAMS member" and sorts above the demo rows.
 */
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  Check,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wifi,
  X,
} from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { HirersResponse, PlatformJob } from "@/types";
import { Badge, Button, Card, Chip, Input, Label, Select, Skeleton, Textarea } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/hooks/use-toast";
import { fmt } from "@/lib/utils";

const CURRENCY: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", KES: "KSh", GHS: "₵" };

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}m`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function salary(job: PlatformJob) {
  if (!job.salary) return "Salary not stated";
  const sym = CURRENCY[job.salary.currency] ?? `${job.salary.currency} `;
  return `${sym}${compact(job.salary.min)}${job.salary.max ? ` – ${sym}${compact(job.salary.max)}` : "+"} / year`;
}

export default function HirersPage() {
  return (
    <React.Suspense fallback={null}>
      <HirersPageInner />
    </React.Suspense>
  );
}

function HirersPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = React.useState("");
  const [q, setQ] = React.useState("");
  const [seniority, setSeniority] = React.useState("");
  const [remote, setRemote] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [posting, setPosting] = React.useState(params.get("post") === "1");
  // null = follow the API. Deriving this instead of setting it in an effect keeps
  // the first paint of the prompt in the same render as the data that needs it.
  const [askChoice, setAskChoice] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const queryParams = {
    q: q || undefined,
    seniority: seniority || undefined,
    remote: remote ? "true" : undefined,
  };
  const jobs = useQuery<HirersResponse>({
    queryKey: qk.hirersList(queryParams),
    queryFn: () => appFetch("/hirers/jobs", { params: queryParams, _auth: true }),
    staleTime: 30_000,
  });

  // no profession → ask before showing a wall of unrelated roles
  const needsProfession = jobs.data?.viewer.needs_profession ?? false;
  const asking = askChoice ?? needsProfession;

  const track = useMutation({
    mutationFn: (job: PlatformJob) =>
      appFetch("/applications", {
        method: "POST",
        body: {
          company_name: job.company,
          role_title: job.title,
          status: "saved",
          source: "hirers",
          url: job.contact_email ? `mailto:${job.contact_email}` : null,
          notes: job.demo ? "Platform listing (demo data)" : "Posted on JAMS",
          tags: job.tags.slice(0, 4),
        },
        _auth: true,
      }),
    meta: { invalidates: [["applications"], ["analytics"]], errorFallback: "Could not add it to the tracker" },
    onSuccess: () => toast("Saved to your tracker", "success"),
  });

  const profession = jobs.data?.viewer.profession ?? "";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Hirers"
        icon={<Briefcase className="h-3.5 w-3.5" />}
        title="Jobs posted on JAMS"
        description="Roles written by companies and members here, ranked against your field and skills. Nothing aggregated, every listing has a person behind it."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setAskChoice(true)}>
              <Sparkles className="h-3.5 w-3.5" /> {profession ? "Change field" : "Set my field"}
            </Button>
            <Button size="sm" variant="azure" onClick={() => setPosting(true)}>
              <Plus className="h-3.5 w-3.5" /> Post a job
            </Button>
          </>
        }
      />

      {needsProfession && !asking && (
        <Card className="border-ember/40 bg-ember/8 p-4">
          <p className="text-sm font-semibold">Tell us your field to see roles that fit</p>
          <p className="mt-1 text-xs text-muted-foreground">You skipped it at sign-up. One answer unlocks the ranked list.</p>
          <Button size="sm" className="mt-3" onClick={() => setAskChoice(true)}>
            Pick my profession
          </Button>
        </Card>
      )}

      {/* search + filters */}
      <div className="glass-sheet sticky top-[68px] z-20 rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Search ${profession || "roles"} — company, title, skill…`}
              aria-label="Search platform jobs"
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

        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {profession || "field"}
          </span>
          {jobs.data ? (
            <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
              {jobs.data.total} role{jobs.data.total === 1 ? "" : "s"} · {jobs.data.demo ? "includes demo listings" : "all live"}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">loading…</span>
          )}
          {(seniority || remote || q) && (
            <button
              type="button"
              onClick={() => {
                setSeniority("");
                setRemote(false);
                setText("");
                setQ("");
              }}
              className="ml-auto shrink-0 text-[11px] font-semibold text-accent hover:underline"
            >
              reset
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-2 grid gap-3 border-t border-border pt-3 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <Label>Seniority</Label>
              <div className="flex flex-wrap gap-1.5">
                {["junior", "mid", "senior", "staff"].map((s) => (
                  <Chip key={s} active={seniority === s} onClick={() => setSeniority(seniority === s ? "" : s)}>
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>Remote</Label>
              <Chip active={remote} onClick={() => setRemote((v) => !v)}>
                <Wifi className="h-3 w-3" /> Remote only
              </Chip>
            </div>
          </div>
        )}
      </div>

      {jobs.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : jobs.error ? (
        <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} />
      ) : (jobs.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title={q || seniority || remote ? "No roles under those filters" : "No roles posted yet"}
          description={
            q || seniority || remote
              ? "Drop a filter, or post the role you are looking for and let people come to you."
              : "Hirers post here directly. If you are hiring, this is the fastest way to reach people already on JAMS."
          }
          action={
            <Button variant="azure" onClick={() => setPosting(true)}>
              <Plus className="h-4 w-4" /> Post a job
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {jobs.data!.items.map((job, i) => (
            <JobListing
              key={job.id}
              job={job}
              index={i}
              onTrack={() => track.mutate(job)}
              tracking={track.isPending && track.variables?.id === job.id}
              onOpen={() => router.push("/tracker")}
            />
          ))}
        </div>
      )}

      {posting && <PostJobDialog open onClose={() => setPosting(false)} profession={profession} />}
      <ProfessionDialog open={asking} onClose={() => setAskChoice(false)} current={profession} options={jobs.data?.professions ?? []} />
    </PageShell>
  );
}

function JobListing({
  job,
  index,
  onTrack,
  tracking,
  onOpen,
}: {
  job: PlatformJob;
  index: number;
  onTrack: () => void;
  tracking?: boolean;
  onOpen: () => void;
}) {
  const [tracked, setTracked] = React.useState(false);
  return (
    <Card className="animate-stagger flex flex-col p-4 sm:p-5" style={{ "--i": Math.min(index, 8) } as React.CSSProperties}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-muted font-display text-sm font-extrabold">
          {job.company.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="font-display text-base font-bold leading-tight">{job.title}</h2>
            {!job.demo && <Badge tone="mint">on JAMS</Badge>}
            {job.mine && <Badge tone="orchid">yours</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {job.company} · {job.employment_type} · {job.seniority ?? "any level"}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">match</span>
          <span className="tnum font-display text-lg font-extrabold">{job.match.score}</span>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {job.location || "Location flexible"}
        </span>
        {job.remote && (
          <span className="inline-flex items-center gap-1">
            <Wifi className="h-3 w-3" /> Remote
          </span>
        )}
        <span className="font-semibold text-foreground">{salary(job)}</span>
      </div>

      {job.match.reasons.length > 0 && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">why this ranks:</span> {job.match.reasons.join(" · ")}
        </p>
      )}

      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{job.description}</p>

      {job.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {job.tags.slice(0, 5).map((t) => (
            <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-[10px] text-muted-foreground">{fmt.ago(job.posted_at)}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {job.contact_email && (
            <a
              href={`mailto:${job.contact_email}?subject=${encodeURIComponent(`Application: ${job.title}`)}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-medium transition-colors hover:border-ember/50 hover:bg-ember/10"
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> Apply
            </a>
          )}
          <Button
            size="sm"
            variant={tracked ? "secondary" : "azure"}
            disabled={tracking || tracked}
            onClick={() => {
              onTrack();
              setTracked(true);
            }}
          >
            {tracked ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {tracked ? "Tracked" : "Track"}
          </Button>
          {tracked && (
            <Button size="sm" variant="ghost" onClick={onOpen} title="Open the tracker">
              Open
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ───────────────────────── create a job posting ──────────────────────── */

function PostJobDialog({ open, onClose, profession }: { open: boolean; onClose: () => void; profession: string }) {
  const [company, setCompany] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [field, setField] = React.useState(profession);
  const [seniority, setSeniority] = React.useState("mid");
  const [location, setLocation] = React.useState("Lagos, Nigeria");
  const [remote, setRemote] = React.useState(false);
  const [type, setType] = React.useState("full-time");
  const [min, setMin] = React.useState("");
  const [max, setMax] = React.useState("");
  const [currency, setCurrency] = React.useState("NGN");
  const [description, setDescription] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [email, setEmail] = React.useState("");

  const post = useMutation({
    mutationFn: () =>
      appFetch("/hirers/jobs", {
        method: "POST",
        body: {
          company: company.trim(),
          title: title.trim(),
          profession: field.trim() || profession,
          seniority,
          location: location.trim() || undefined,
          remote,
          employment_type: type,
          salary_min: min ? Number(min) : undefined,
          salary_max: max ? Number(max) : undefined,
          currency: currency || undefined,
          description: description.trim() || undefined,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          contact_email: email.trim() || undefined,
        },
        _auth: true,
      }),
    meta: { invalidates: [["hirers"]], errorFallback: "Job not posted" },
    onSuccess: () => {
      toast("Role posted — it is live on Hirers now", "success");
      setCompany("");
      setTitle("");
      setDescription("");
      setTags("");
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} label="Post a job" className="max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold">Post a role</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Written for people already on JAMS: it is ranked against their field and skills, and one tap adds it to their tracker.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Company</Label>
          <Input aria-label="Company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Paystack" />
        </div>
        <div>
          <Label>Role title</Label>
          <Input aria-label="Role title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Frontend Engineer" />
        </div>
        <div>
          <Label>Profession this is for</Label>
          <Input aria-label="Profession this is for" value={field} onChange={(e) => setField(e.target.value)} placeholder="software engineering" />
        </div>
        <div>
          <Label>Seniority</Label>
          <Select aria-label="Seniority" value={seniority} onChange={(e) => setSeniority(e.target.value)}>
            {["intern", "junior", "mid", "senior", "staff", "lead"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Location</Label>
          <Input aria-label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lagos, Nigeria" />
        </div>
        <div>
          <Label>Type</Label>
          <Select aria-label="Employment type" value={type} onChange={(e) => setType(e.target.value)}>
            {["full-time", "part-time", "contract", "internship"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <div>
            <Label>Currency</Label>
            <Select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {Object.keys(CURRENCY).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Salary min</Label>
            <Input aria-label="Salary min" type="number" value={min} onChange={(e) => setMin(e.target.value)} placeholder="9000000" />
          </div>
          <div>
            <Label>Salary max</Label>
            <Input aria-label="Salary max" type="number" value={max} onChange={(e) => setMax(e.target.value)} placeholder="14000000" />
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Label>Description</Label>
        <Textarea
          aria-label="Description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What the person will own, the stack, and what the first ninety days look like."
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Tags (comma separated)</Label>
          <Input aria-label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="react, typescript, testing" />
        </div>
        <div>
          <Label>Contact email (optional)</Label>
          <Input aria-label="Contact email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jobs@company.com" />
        </div>
      </div>

      <Button
        type="button"
        variant={remote ? "secondary" : "outline"}
        size="sm"
        className="mt-3"
        onClick={() => setRemote((v) => !v)}
        aria-pressed={remote}
      >
        <Wifi className="h-3.5 w-3.5" /> {remote ? "Remote" : "On-site / hybrid"}
      </Button>

      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="azure" onClick={() => post.mutate()} disabled={post.isPending || !company.trim() || !title.trim() || !(field.trim() || profession)}>
          {post.isPending ? "Posting…" : "Post role"}
        </Button>
      </div>
    </Modal>
  );
}

/* ─────────────────────────── the profession ask ──────────────────────── */

function ProfessionDialog({
  open,
  onClose,
  current,
  options,
}: {
  open: boolean;
  onClose: () => void;
  current: string;
  options: string[];
}) {
  const [value, setValue] = React.useState(current);
  const [touched, setTouched] = React.useState(false);
  const shown = touched ? value : current;

  const save = useMutation({
    mutationFn: () => appFetch("/hirers/profession", { method: "POST", body: { profession: shown }, _auth: true }),
    meta: { invalidates: [["hirers"], ["people"], ["profile"]], errorFallback: "Could not save your field" },
    onSuccess: () => {
      toast("Field saved — the list is ranked for you now", "success");
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} label="Your profession" className="max-w-md">
      <p className="font-display text-lg font-bold">What do you do?</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        This is the one answer the whole network uses: Hirers ranks roles by it, Discover finds people who share it, and Event suggestions follow it.
        It is stored on your profile, so you are only asked once.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {options.slice(0, 10).map((p) => (
          <Chip
            key={p}
            active={shown === p}
            onClick={() => {
              setTouched(true);
              setValue(p);
            }}
          >
            {p}
          </Chip>
        ))}
      </div>
      <div className="mt-3">
        <Label>Or type it</Label>
        <Input
          value={shown}
          onChange={(e) => {
            setTouched(true);
            setValue(e.target.value);
          }}
          placeholder="e.g. frontend engineer"
          autoFocus
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <CalendarClock className="h-3 w-3" /> change it any time from Hirers
        </span>
        <Button variant="azure" onClick={() => save.mutate()} disabled={save.isPending || !shown.trim()}>
          {save.isPending ? "Saving…" : "Use this field"}
        </Button>
      </div>
    </Modal>
  );
}
