"use client";

/** Outreach (§26): template merge composer, Gmail hand-off send, cadence cap, sequences, threads. */
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CalendarClock, Layers, Mail, Send, Sparkles } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { Application, Outreach, Paged, Template } from "@/types";
import { Badge, Button, Card, Input, Label, ProgressBar, Select, Skeleton, Textarea } from "@/components/ui/base";
import { EmptyState, ErrorState, InlineBanner } from "@/components/ui/feedback";
import { fmt } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Cadence = { sent_today: number; daily_cap: number; remaining: number; due_steps: { id: string; subject: string; scheduled_at: string; step_no: number }[]; paused_sequences: number };

export default function OutreachPage() {
  return (
    <React.Suspense fallback={null}>
      <OutreachPageInner />
    </React.Suspense>
  );
}

function OutreachPageInner() {
  const search = useSearchParams();
  const [appId, setAppId] = React.useState(search.get("app") ?? "");
  const [templateId, setTemplateId] = React.useState("");
  const [subject, setSubject] = React.useState("Quick hello about {role} at {company}");
  const [body, setBody] = React.useState(
    "Hi {contact_name},\n\nI’m applying for {role} at {company}, my background in {top_skills} lines up with what the posting asks for. Would love to compare notes.\n\nThanks,\n{my_name}"
  );

  const applications = useQuery<Paged<Application>>({
    queryKey: qk.applicationList({ page_size: 200, status: "applied" }),
    queryFn: () => appFetch("/applications", { params: { page_size: 200 }, _auth: true }),
  });

  const templates = useQuery<{ items: Template[] }>({
    queryKey: qk.templates({ kind: "email" }),
    queryFn: () => appFetch("/templates", { params: { kind: "email" }, _auth: true }),
  });

  const messages = useQuery<{ items: Outreach[] }>({
    queryKey: qk.outreach({}),
    queryFn: () => appFetch("/outreach", { _auth: true }),
  });

  const cadence = useQuery<Cadence>({
    queryKey: ["outreach", "cadence"],
    queryFn: () => appFetch("/outreach/cadence", { _auth: true }),
  });

  const threads = useQuery<{ items: any[] }>({
    queryKey: qk.threads(),
    queryFn: () => appFetch("/inbox/threads", { _auth: true }),
  });

  // apply selected template client-side, then let the server merge variables
  React.useEffect(() => {
    const t = templates.data?.items.find((x) => x.id === templateId);
    if (t) {
      if (t.subject) setSubject(t.subject);
      setBody(t.body);
    }
  }, [templateId, templates.data]);

  const createDraft = useMutation({
    mutationFn: () =>
      appFetch<Outreach>("/outreach", {
        method: "POST",
        body: { app_id: appId || null, template_id: templateId || null, subject, body },
        _auth: true,
      }),
    meta: { invalidates: [["outreach"]] },
    onSuccess: (o) => toast(`Draft saved, step ${o.step_no}`, "success"),
  });

  const send = useMutation({
    mutationFn: (id: string) => appFetch<{ compose_url: string; sent_today: number; daily_cap: number }>(`/outreach/${id}/send`, { method: "POST", body: { via: "gmail_open", confirm: true }, _auth: true }),
    meta: { invalidates: [["outreach"], ["applications"], ["streaks"]] },
    onSuccess: (res) => {
      toast(`Opening Gmail, ${res.sent_today}/${res.daily_cap} sends today`, "success");
      if (res.compose_url) window.open(res.compose_url, "_blank", "noopener");
    },
    onError: (e: any) => toast(e?.error?.detail ?? e?.message ?? "Could not prepare send", "error"),
  });

  const pause = useMutation({
    mutationFn: (o: Outreach) => appFetch(`/outreach/${o.id}`, { method: "PUT", body: { state: o.state === "paused" ? "draft" : "paused" }, _auth: true }),
    meta: { invalidates: [["outreach"]] },
  });

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1.4fr_1fr]">
      {/* composer */}
      <div className="space-y-5">
        <header>
          <h1 className="font-display text-2xl font-extrabold">Outreach</h1>
          <p className="text-sm text-muted-foreground">Compose once, merge variables, hand off to Gmail, you press Send (§26.4).</p>
        </header>

        <Card className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Linked application</Label>
              <Select value={appId} onChange={(e) => setAppId(e.target.value)}>
                <option value=""> none (standalone pitch),</option>
                {applications.data?.items.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.company_name} · {a.role_title}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Template</Label>
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value=""> write from scratch,</option>
                {templates.data?.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.archetype})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div>
            <Label>Body, {'{{variables}}'} merge against profile + application</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[180px] font-mono text-[13px]" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => createDraft.mutate()} disabled={!subject.trim() || !body.trim() || createDraft.isPending}>
              <Sparkles className="h-4 w-4" /> Save draft
            </Button>
            <p className="text-[11px] text-muted-foreground">
              variables: contact_name · company · role · my_name · top_skills · days_since_applied
            </p>
          </div>
        </Card>

        {/* messages / sequence */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Messages & sequence steps</h2>
            <Badge tone="azure">{messages.data?.items.length ?? 0}</Badge>
          </div>
          {messages.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (messages.data?.items.length ?? 0) === 0 ? (
            <EmptyState icon={<Send className="h-6 w-6" />} title="No outreach yet" description="Draft one above, or apply to a job and offer to follow up in 7 days." />
          ) : (
            <ul className="space-y-2">
              {messages.data!.items.map((o, i) => (
                <li key={o.id} className="animate-stagger rounded-xl border border-border p-3" style={{ ["--i" as any]: i }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {o.step_no > 0 && <span className="mr-1.5 text-[10px] font-bold uppercase text-muted-foreground">step {o.step_no}</span>}
                      {o.subject}
                    </p>
                    <Badge
                      tone={o.state.startsWith("sent") ? "mint" : o.state === "replied" ? "orchid" : o.state === "paused" ? "amber" : o.state === "scheduled" ? "azure" : "neutral"}
                      className="shrink-0 capitalize"
                    >
                      {o.state.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{o.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    {o.scheduled_at && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> due {fmt.ago(o.scheduled_at)}
                      </span>
                    )}
                    {o.opens > 0 && <span>opened {o.opens}×</span>}
                    {o.clicks > 0 && <span>clicked {o.clicks}×</span>}
                    <span className="ml-auto flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => pause.mutate(o)}>
                        {o.state === "paused" ? "Resume" : "Pause"}
                      </Button>
                      <Button size="sm" variant="azure" onClick={() => send.mutate(o.id)} disabled={send.isPending}>
                        <Mail className="h-3.5 w-3.5" /> Send via Gmail
                      </Button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* right rail */}
      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Cadence health</h2>
          {cadence.isPending ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <p className="tnum font-display text-2xl font-extrabold">
                  {cadence.data!.sent_today}
                  <span className="text-sm font-semibold text-muted-foreground">/{cadence.data!.daily_cap}</span>
                </p>
                <p className="text-xs text-muted-foreground">{cadence.data!.remaining} remaining today</p>
              </div>
              <ProgressBar value={(cadence.data!.sent_today / Math.max(1, cadence.data!.daily_cap)) * 100} className="mt-2" />
              {cadence.data!.remaining <= 3 && (
                <InlineBanner tone="warn" className="mt-3" title="Approaching the cap">
                  The free-tier cap protects deliverability, the rest queues for tomorrow.
                </InlineBanner>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-muted/60 p-2.5">
                  <p className="tnum font-bold">{cadence.data!.due_steps.length}</p>
                  <p className="text-muted-foreground">steps due now</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-2.5">
                  <p className="tnum font-bold">{cadence.data!.paused_sequences}</p>
                  <p className="text-muted-foreground">paused (replied)</p>
                </div>
              </div>
              {cadence.data!.due_steps.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {cadence.data!.due_steps.slice(0, 4).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">#{s.step_no} {s.subject}</span>
                      <span className="shrink-0 text-muted-foreground">{fmt.ago(s.scheduled_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Layers className="h-4 w-4" /> Inbox threads
          </h2>
          {threads.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (threads.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No replies ingested yet, connect a mailbox in Inbox sync.</p>
          ) : (
            <ul className="space-y-2">
              {threads.data!.items.slice(0, 6).map((t) => (
                <li key={t.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{t.subject}</p>
                    <Badge tone="neutral">{t.messages} msg</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t.company_name ?? t.contact_email ?? "unknown"} · {fmt.ago(t.last_message_at ?? t.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">How sending works</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            No paid SMTP: JAMS prepares the message, opens Gmail pre-filled, and you press Send. Inbound replies are ingested through{" "}
            <span className="font-semibold text-foreground">Inbox sync</span> and classified deterministically, interview invite, rejection, OOO, bounce.
          </p>
        </Card>
      </div>
    </div>
  );
}
