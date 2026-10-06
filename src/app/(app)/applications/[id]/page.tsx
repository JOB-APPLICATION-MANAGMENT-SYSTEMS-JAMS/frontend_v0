"use client";

/** Application record (§40.2): timeline · status controls · CV/template used · thread · notes · next action. */
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, ExternalLink, FileText, Mail, MessageSquare, StickyNote } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { AppStatus, Application, AppEvent, Outreach } from "@/types";
import { Badge, Button, Card, Label, Select, Skeleton, Textarea } from "@/components/ui/base";
import { ErrorState, InlineBanner } from "@/components/ui/feedback";
import { STATUS_META, cn, fmt } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [followUp, setFollowUp] = React.useState("");

  const detail = useQuery<Application & { events: AppEvent[]; outreach: Outreach[]; messages: { id: string | number; from_addr: string; classification: string | null; body: string }[] }>({
    queryKey: qk.application(id),
    queryFn: () => appFetch(`/applications/${id}`, { _auth: true }),
  });

  const move = useMutation({
    mutationFn: (status: AppStatus) => appFetch(`/applications/${id}/status`, { method: "POST", body: { status }, _auth: true }),
    meta: { invalidates: [["applications"], ["analytics"], ["streaks"], ["outreach"]], errorFallback: "Invalid transition" },
    onSuccess: (_d, s) => toast(`Status → ${STATUS_META[s]?.label}`, "success"),
  });

  const saveNote = useMutation({
    mutationFn: () => appFetch(`/applications/${id}/notes`, { method: "POST", body: { note }, _auth: true }),
    meta: { invalidates: [["applications"]] },
    onSuccess: () => {
      setNote("");
      toast("Note added to timeline", "success");
    },
  });

  const scheduleFollowUp = useMutation({
    mutationFn: () => {
      const at = new Date(Date.now() + Number(followUp) * 86_400_000).toISOString();
      return appFetch(`/applications/${id}`, { method: "PUT", body: { next_action_at: at }, _auth: true });
    },
    meta: { invalidates: [["applications"]] },
    onSuccess: () => toast("Follow-up scheduled", "success"),
  });

  if (detail.isPending) return <Skeleton className="h-96 w-full" />;
  if (detail.error) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;
  const a = detail.data!;
  const allowed = ["applied", "viewed", "screen", "interview", "offer", "rejected", "ghosted", "withdrawn"].filter((s) => s !== a.status);

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-5">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tracker
        </button>

        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-extrabold">{a.role_title}</h1>
              <p className="text-sm text-muted-foreground">{a.company_name}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="rounded-full border px-3 py-1 text-xs font-bold capitalize" style={{ color: STATUS_META[a.status]?.color, borderColor: `${STATUS_META[a.status]?.color}66`, background: `${STATUS_META[a.status]?.color}14` }}>
                {STATUS_META[a.status]?.label}
              </span>
              <Badge tone={a.kind === "pitch" ? "orchid" : "azure"} className="capitalize">
                {a.kind}
              </Badge>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Meta label="Applied" value={fmt.date(a.applied_at ?? a.created_at)} />
            <Meta label="Replied" value={a.replied_at ? fmt.date(a.replied_at) : "n/a"} />
            <Meta label="First reply" value={a.first_reply_days != null ? `${a.first_reply_days} days` : "n/a"} />
            <Meta label="Source" value={a.source ?? "n/a"} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {a.url && (
              <a href={a.url} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-3.5 w-3.5" /> Posting
                </Button>
              </a>
            )}
            <Button size="sm" variant="ghost" onClick={() => router.push(`/outreach?app=${a.id}`)}>
              <Mail className="h-3.5 w-3.5" /> Compose outreach
            </Button>
            <Button size="sm" variant="ghost" onClick={() => router.push(`/companies/${a.company_id}`)} disabled={!a.company_id}>
              <FileText className="h-3.5 w-3.5" /> Company record
            </Button>
          </div>

          {/* status controls */}
          <div className="mt-4 border-t border-border pt-4">
            <Label>Move to</Label>
            <div className="flex flex-wrap gap-1.5">
              {allowed.map((s) => (
                <button
                  key={s}
                  onClick={() => move.mutate(s as AppStatus)}
                  disabled={move.isPending}
                  className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors hover:brightness-110", "bg-white/50 dark:bg-white/5")}
                  style={{ color: STATUS_META[s].color, borderColor: `${STATUS_META[s].color}55` }}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* timeline (append-only event log) */}
        <Card className="p-5">
          <h2 className="font-display mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">Timeline</h2>
          <ol className="relative space-y-4 border-l border-border pl-5">
            {a.events.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[image:var(--gradient-brand)] shadow" />
                <p className="text-sm font-medium capitalize">
                  {ev.type.replace(/_/g, " ")}
                  {ev.payload?.to ? ` → ${ev.payload.to}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmt.dateTime(ev.at)} · by {ev.actor}
                  {ev.payload?.classification ? ` · classified ${ev.payload.classification}` : ""}
                </p>
                {ev.payload?.note && <p className="mt-0.5 text-xs italic text-muted-foreground">“{ev.payload.note}”</p>}
              </li>
            ))}
            {a.events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
          </ol>
        </Card>
      </div>

      {/* right rail */}
      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Next action</h2>
          {a.next_action_at ? (
            <div className="glass-amber flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm">
              <CalendarClock className="h-4 w-4 text-amber-600" />
              Follow-up due {fmt.date(a.next_action_at)}
            </div>
          ) : (
            <div className="flex gap-2">
              <Select value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="flex-1">
                <option value="">nudge in…</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
              </Select>
              <Button size="sm" variant="warning" disabled={!followUp || scheduleFollowUp.isPending} onClick={() => scheduleFollowUp.mutate()}>
                Set
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Notes</h2>
          {a.notes && <p className="mb-3 whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-sm">{a.notes}</p>}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? What worked? Referral contact…" />
          <Button size="sm" className="mt-2" disabled={!note || saveNote.isPending} onClick={() => saveNote.mutate()}>
            <StickyNote className="h-3.5 w-3.5" /> Add note
          </Button>
        </Card>

        <Card className="p-5">
          <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Outreach & threads</h2>
          {a.outreach.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <ul className="space-y-2">
              {a.outreach.map((o) => (
                <li key={o.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{o.subject}</p>
                    <Badge tone={o.state.startsWith("sent") ? "mint" : o.state === "paused" ? "amber" : "neutral"} className="shrink-0 capitalize">
                      {o.state.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{o.body}</p>
                  <p className="mt-1.5 flex gap-3 text-[11px] text-muted-foreground">
                    <span>step {o.step_no}</span>
                    {o.opens > 0 && <span>opened {o.opens}×</span>}
                    {o.sent_at && <span>sent {fmt.ago(o.sent_at)}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {a.messages.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" /> Inbound replies
              </p>
              {a.messages.map((m) => (
                <div key={m.id} className="rounded-xl bg-muted/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold">{m.from_addr}</p>
                    <Badge tone={m.classification === "interview_invite" ? "orchid" : m.classification === "rejected" ? "rose" : "mint"} className="capitalize">
                      {m.classification ?? "neutral"}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{m.body}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {a.capture && (
          <Card className="p-5">
            <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Captured snapshot</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{String(a.capture.description ?? "").slice(0, 600) || "No description captured."}</p>
            {Array.isArray(a.capture.form_fields) && a.capture.form_fields.length > 0 && (
              <InlineBanner tone="info" className="mt-3" title={`${a.capture.form_fields.length} form fields seen`}>
                Autofill will map them against your profile when you open the posting.
              </InlineBanner>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="tnum font-medium">{value}</p>
    </div>
  );
}
