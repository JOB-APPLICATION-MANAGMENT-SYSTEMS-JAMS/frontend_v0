"use client";

/**
 * A professional's public record.
 *
 * The page is ordered the way a cautious customer decides: identity, the work
 * itself, then what has been checked, then what other customers said. Reviews are
 * split into "confirmed job" and unverified feedback, and the professional's reply
 * sits under the review without ever replacing it.
 */
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  MapPin,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react";
import { appFetch } from "@/lib/api";
import type { Engagement, ProProfile } from "@/features/higher-as/types";
import { Badge, Button, Card, Input, Label, Skeleton, Textarea } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { PageShell } from "@/components/ui/layout";
import { Modal } from "@/components/ui/modal";
import {
  AutoSummary,
  ContactDialog,
  CredentialStatusBadge,
  dateOrDash,
  dayRate,
  RatingBlock,
  ShareButton,
  VerificationNote,
  VerifiedJobTag,
} from "@/features/higher-as/ui";
import { cn, fmt } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function ProProfilePage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  return <ProProfileInner id={id} />;
}

function ProProfileInner({ id }: { id: string }) {
  const router = useRouter();
  const [contactOpen, setContactOpen] = React.useState(false);
  const [hireOpen, setHireOpen] = React.useState(false);

  const pro = useQuery<ProProfile>({
    queryKey: ["higher-as", "pro", id],
    queryFn: () => appFetch(`/higher-as/pros/${id}`, { _auth: true }),
    enabled: !!id,
  });

  const save = useMutation({
    mutationFn: () => appFetch<{ saved: boolean }>(`/higher-as/pros/${id}/save`, { method: "POST", _auth: true }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Could not update saved" },
    onSuccess: (res) => toast(res.saved ? "Saved" : "Removed from saved", "success"),
  });

  if (pro.isPending) {
    return (
      <PageShell>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }
  if (pro.error || !pro.data) {
    return (
      <PageShell>
        <ErrorState error={pro.error} onRetry={() => pro.refetch()} />
      </PageShell>
    );
  }

  const p = pro.data;
  const rate = dayRate(p.day_rate_min, p.day_rate_max, p.currency);
  const initials = p.display_name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const verified = p.credentials.filter((c) => c.status === "verified");
  const pending = p.credentials.filter((c) => c.status === "pending");

  return (
    <PageShell>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/higher-as" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Higher As
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="truncate text-xs font-medium text-foreground">{p.display_name}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <ShareButton path={`/higher-as/${p.id}`} />
          <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={save.isPending} aria-pressed={p.saved}>
            {p.saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            {p.saved ? "Saved" : "Save"}
          </Button>
          {p.is_owner ? (
            <Button size="sm" variant="azure" onClick={() => router.push("/higher-as/me")}>
              <Pencil className="h-3.5 w-3.5" /> Edit profile
            </Button>
          ) : (
            <Button size="sm" variant="azure" onClick={() => setContactOpen(true)}>
              <MessageCircle className="h-3.5 w-3.5" /> Contact
            </Button>
          )}
        </div>
      </div>

      {/* identity */}
      <Card className="overflow-hidden">
        <div className="h-24 border-b border-border bg-[radial-gradient(120%_140%_at_0%_0%,hsl(var(--ember)/0.2),transparent_62%)]" />
        <div className="-mt-8 flex flex-wrap items-end gap-3 px-4 pb-4 sm:px-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-border bg-background font-display text-lg font-extrabold shadow-sm">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="font-display text-xl font-extrabold leading-tight sm:text-2xl">{p.display_name}</h1>
              {p.available && <Badge tone="mint">available</Badge>}
              {p.is_owner && <Badge tone="orchid">your profile</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {p.trade_label}
              {p.city ? ` · ${p.city}` : ""}
              {p.years_experience != null ? ` · ${p.years_experience} years` : ""}
            </p>
            <div className="mt-1.5">
              <ReviewLineBadge pro={p} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-3 text-[11px] text-muted-foreground sm:px-5">
          {p.service_area && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">Covers {p.service_area}</span>
            </span>
          )}
          <span className="font-semibold text-foreground">{rate ?? "Rate on request"}</span>
          {verified.length > 0 && (
            <span className="inline-flex items-center gap-1 text-ember-deep dark:text-ember-soft">
              <ShieldCheck className="h-3 w-3" /> {verified.length} verified credential{verified.length === 1 ? "" : "s"}
            </span>
          )}
          {pending.length > 0 && <span>{pending.length} awaiting review</span>}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          {/* what they say about themselves */}
          <Card className="p-4 sm:p-5">
            <h2 className="eyebrow">About</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{p.summary || "This professional has not written a summary yet."}</p>
            {p.headline && <p className="mt-2 text-sm font-medium text-muted-foreground">{p.headline}</p>}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Written by the professional. A self-description is not an independent endorsement.
            </p>
          </Card>

          {/* work */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="eyebrow flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" /> Work and services
              </h2>
              <span className="text-[11px] text-muted-foreground">{p.posts.length} post{p.posts.length === 1 ? "" : "s"}</span>
            </div>
            {p.posts.length === 0 ? (
              <EmptyState title="No work posted yet" description="When this professional publishes a job, the photos and the write-up appear here." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {p.posts.map((post) => (
                  <Card key={post.id} className="flex flex-col overflow-hidden">
                    {post.image_url && (
                      <div className="h-36 w-full bg-cover bg-center" style={{ backgroundImage: `url(${post.image_url})` }} role="img" aria-label={post.title} />
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-display text-sm font-bold leading-tight">{post.title}</p>
                        <Badge tone="neutral" className="shrink-0 capitalize">{post.kind}</Badge>
                      </div>
                      {post.body && <p className="text-[13px] leading-relaxed text-muted-foreground">{post.body}</p>}
                      {post.auto_summary && <AutoSummary text={post.auto_summary} />}
                      {post.tags.length > 0 && (
                        <div className="mt-auto flex flex-wrap gap-1">
                          {post.tags.map((t) => (
                            <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{t}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">{fmt.date(post.created_at)}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* reviews */}
          <ReviewsSection pro={p} />
        </div>

        {/* evidence aside */}
        <aside className="space-y-4 lg:sticky lg:top-[92px] lg:self-start">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="eyebrow flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Credentials
              </h2>
              {p.is_admin && (
                <Link href="/higher-as/review" className="text-[11px] font-semibold text-accent hover:underline">
                  review queue
                </Link>
              )}
            </div>
            {p.credentials.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Nothing submitted yet. A missing credential is not evidence of anything either way.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {p.credentials.map((c) => (
                  <li key={c.id} className="rounded-xl border border-border p-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-tight">{c.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[c.issuer, c.kind].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <CredentialStatusBadge status={c.status} />
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {c.issued_on ? `Issued ${dateOrDash(c.issued_on)}` : c.reviewed_at ? `Reviewed ${dateOrDash(c.reviewed_at)}` : "Awaiting review"}
                      {c.expires_on ? ` · expires ${dateOrDash(c.expires_on)}` : ""}
                    </p>
                    {c.review_note && <p className="mt-1 text-[10px] text-muted-foreground">{c.review_note}</p>}
                  </li>
                ))}
              </ul>
            )}
            <VerificationNote className="mt-3 border-t border-border pt-2.5" />
          </Card>

          {!p.is_owner && (
            <Card className="p-4">
              <h2 className="eyebrow flex items-center gap-1.5">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> Hired them before?
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Record the job and ask them to confirm it. Confirmed jobs are what make a review count as verified service, and they are the strongest evidence on this page.
              </p>
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setHireOpen(true)}>
                Record a job
              </Button>
            </Card>
          )}
        </aside>
      </div>

      {contactOpen && <ContactDialog proId={p.id} name={p.display_name} open onClose={() => setContactOpen(false)} />}
      {hireOpen && <RecordJobDialog proId={p.id} proName={p.display_name} onClose={() => setHireOpen(false)} />}
    </PageShell>
  );
}

function ReviewLineBadge({ pro }: { pro: ProProfile }) {
  if (!pro.rating.count) return <span className="text-[11px] text-muted-foreground">No customer reviews yet</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn("h-3.5 w-3.5", i <= Math.round(pro.rating.avg ?? 0) ? "fill-ember text-ember" : "text-border")} strokeWidth={1.75} />
        ))}
      </span>
      <span className="tnum font-bold">{pro.rating.avg?.toFixed(1)}</span>
      <span className="text-muted-foreground">
        {pro.rating.count} review{pro.rating.count === 1 ? "" : "s"} · {pro.rating.verified} from confirmed jobs
      </span>
    </span>
  );
}

/* ───────────────────────────── reviews ───────────────────────────────── */

function ReviewsSection({ pro }: { pro: ProProfile }) {
  const [rating, setRating] = React.useState(pro.my_review?.rating ?? 0);
  const [body, setBody] = React.useState(pro.my_review?.body ?? "");
  const [responding, setResponding] = React.useState<string | null>(null);
  const [response, setResponse] = React.useState("");
  const [disputing, setDisputing] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");

  const submit = useMutation({
    mutationFn: () =>
      appFetch(`/higher-as/pros/${pro.id}/reviews`, {
        method: "POST",
        body: { rating, body: body.trim(), engagement_id: pro.reviewable_engagement?.id },
        _auth: true,
      }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Review not saved" },
    onSuccess: () => toast(pro.my_review ? "Review updated" : "Review published", "success"),
  });

  const respond = useMutation({
    mutationFn: (reviewId: string) => appFetch(`/higher-as/reviews/${reviewId}/response`, { method: "POST", body: { response }, _auth: true }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Response not saved" },
    onSuccess: () => {
      toast("Response published", "success");
      setResponding(null);
      setResponse("");
    },
  });

  const dispute = useMutation({
    mutationFn: (reviewId: string) => appFetch(`/higher-as/reviews/${reviewId}/dispute`, { method: "POST", body: { reason }, _auth: true }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Could not send for moderation" },
    onSuccess: () => {
      toast("Sent to moderation - the review stays visible until a reviewer decides", "info");
      setDisputing(null);
      setReason("");
    },
  });

  const canWrite = pro.can_review || !!pro.my_review;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5" /> Customer reviews
        </h2>
        <span className="text-[11px] text-muted-foreground">{pro.rating.count} total</span>
      </div>

      <RatingBlock rating={pro.rating} />

      {canWrite && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[13px] font-semibold">{pro.my_review ? "Edit your review" : "Write a review"}</p>
          {pro.reviewable_engagement ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Tied to “{pro.reviewable_engagement.title}”, which the professional confirmed. This is a verified-service review.
            </p>
          ) : pro.my_review ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">You already reviewed this professional. Editing replaces your previous words, not their rating history.</p>
          ) : (
            <p className="mt-0.5 text-[11px] text-muted-foreground">Without a confirmed job this is published as unverified feedback. It still counts, but it is labelled.</p>
          )}
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                aria-pressed={rating === n}
                className="grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-ember/10"
              >
                <Star className={cn("h-5 w-5", n <= rating ? "fill-ember text-ember" : "text-border")} strokeWidth={1.75} />
              </button>
            ))}
            <span className="ml-1 text-[11px] text-muted-foreground">{rating ? `${rating}/5` : "pick a rating"}</span>
          </div>
          <Textarea
            className="mt-2"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What was the job, what went well, what should the next customer know?"
            aria-label="Your review"
          />
          <Button size="sm" className="mt-2" onClick={() => submit.mutate()} disabled={submit.isPending || !rating || body.trim().length < 10}>
            {submit.isPending ? "Saving…" : pro.my_review ? "Update review" : "Publish review"}
          </Button>
        </div>
      )}

      {pro.reviews.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No reviews yet. A profile with no reviews is unknown, not bad.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {pro.reviews.map((r) => (
            <li key={r.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted font-display text-[10px] font-extrabold">
                  {r.customer_name.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-[13px] font-semibold">{r.customer_name}</span>
                <span className="inline-flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={cn("h-3 w-3", i <= r.rating ? "fill-ember text-ember" : "text-border")} strokeWidth={1.75} />
                  ))}
                </span>
                {r.verified ? <VerifiedJobTag /> : <Badge tone="neutral" title="No confirmed job is attached to this review.">unverified feedback</Badge>}
                {r.dispute_status === "open" && <Badge tone="amber">in moderation</Badge>}
                {r.hidden && <Badge tone="neutral">hidden after review</Badge>}
                <span className="ml-auto text-[10px] text-muted-foreground">{fmt.date(r.created_at)}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">{r.body}</p>

              {r.response && (
                <div className="mt-2 rounded-xl border-l-2 border-ember/50 bg-muted/40 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reply from {pro.display_name}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed">{r.response}</p>
                </div>
              )}

              {pro.is_owner && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {!r.response && (
                    <Button size="sm" variant="ghost" onClick={() => { setResponding(responding === r.id ? null : r.id); setResponse(""); }}>
                      {responding === r.id ? "Cancel" : "Reply"}
                    </Button>
                  )}
                  {r.dispute_status === "none" && (
                    <Button size="sm" variant="ghost" onClick={() => setDisputing(r.id)}>
                      Request moderation
                    </Button>
                  )}
                  {r.dispute_status === "open" && <span className="text-[11px] text-muted-foreground">A reviewer is looking at this.</span>}
                  {r.dispute_status === "dismissed" && <span className="text-[11px] text-muted-foreground">Moderation kept this review.</span>}
                </div>
              )}
              {responding === r.id && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Add context about this job" aria-label="Your reply" />
                  <Button size="sm" onClick={() => respond.mutate(r.id)} disabled={respond.isPending || response.trim().length < 2}>
                    Publish reply
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!disputing} onClose={() => setDisputing(null)} label="Request moderation" className="max-w-md">
        <p className="font-display text-lg font-bold">Request moderation</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          A reviewer will read the review and your reason. The review stays visible and its rating is never edited by you or by JAMS; a reviewer can only keep it or hide it.
        </p>
        <Label className="mt-3 block">What is wrong with it?</Label>
        <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="It describes a job that is not in my records, or it contains harassment." />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDisputing(null)}>Cancel</Button>
          <Button onClick={() => disputing && dispute.mutate(disputing)} disabled={dispute.isPending || reason.trim().length < 10}>
            Send to moderation
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

/* ─────────────────────────── record a job ────────────────────────────── */

function RecordJobDialog({ proId, proName, onClose }: { proId: string; proName: string; onClose: () => void }) {
  const [title, setTitle] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [created, setCreated] = React.useState<Engagement | null>(null);

  const create = useMutation({
    mutationFn: () => appFetch<Engagement>(`/higher-as/pros/${proId}/engagements`, { method: "POST", body: { title: title.trim(), detail: detail.trim() || undefined }, _auth: true }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Could not record the job" },
    onSuccess: (data) => setCreated(data),
  });

  return (
    <Modal open onClose={onClose} label={`Record a job with ${proName}`} className="max-w-md">
      {created ? (
        <>
          <p className="font-display text-lg font-bold">Job recorded</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Ask {proName} to confirm it on their side. Once they do, your review of this job is shown as verified service. Until then it is still welcome as unverified feedback.
          </p>
          <div className="mt-4 flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </>
      ) : (
        <>
          <p className="font-display text-lg font-bold">Record the job</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Only the professional can confirm it happened. This record is private until it is confirmed.</p>
          <Label className="mt-3 block">What was the job?</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Replaced the water pump" />
          <Label className="mt-3 block">Details (optional)</Label>
          <Textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="When it was, what was agreed, anything the review should mention." />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || title.trim().length < 3}>
              {create.isPending ? "Recording…" : "Record job"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
