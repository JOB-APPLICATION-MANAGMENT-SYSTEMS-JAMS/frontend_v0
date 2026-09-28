"use client";

/** Inbox sync (§36): mailbox connect, free message ingestion, classified thread list. */
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Inbox, Link2, Mail, MessageSquare, Send } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import { Badge, Button, Card, Input, Label, Select, Skeleton, Textarea } from "@/components/ui/base";
import { EmptyState, InlineBanner } from "@/components/ui/feedback";
import { fmt } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const CLASS_TONE: Record<string, "mint" | "rose" | "orchid" | "amber" | "azure" | "neutral"> = {
  interested: "mint",
  interview_invite: "orchid",
  rejected: "rose",
  auto_reply: "neutral",
  ooo: "amber",
  bounce: "rose",
  neutral: "neutral",
};

export default function InboxSyncPage() {
  const [address, setAddress] = React.useState("");
  const [msg, setMsg] = React.useState({ from: "", subject: "", body: "" });
  const [openThread, setOpenThread] = React.useState<string | null>(null);

  const mailbox = useQuery<{ items: any[]; connected: boolean }>({ queryKey: qk.mailbox(), queryFn: () => appFetch("/mailboxes", { _auth: true }) });
  const threads = useQuery<{ items: any[] }>({ queryKey: qk.threads(), queryFn: () => appFetch("/inbox/threads", { _auth: true }) });
  const threadDetail = useQuery<any>({
    queryKey: ["inbox", "thread", openThread],
    queryFn: () => appFetch(`/inbox/threads/${openThread}`, { _auth: true }),
    enabled: !!openThread,
  });

  const connect = useMutation({
    mutationFn: () => appFetch("/mailboxes", { method: "POST", body: { kind: "imap", address }, _auth: true }),
    meta: { invalidates: [["inbox"]] },
    onSuccess: () => toast("Mailbox recorded — local mode, ingestion below is the live path", "success"),
  });

  const ingest = useMutation({
    mutationFn: () => appFetch("/inbox/messages", { method: "POST", body: { from: msg.from, subject: msg.subject, body: msg.body }, _auth: true }),
    meta: { invalidates: [["inbox"], ["applications"], ["analytics"], ["streaks"]] },
    onSuccess: (res: any) => {
      toast(`Ingested & classified → ${res.classification ?? "matched"}`, "success");
      setMsg({ from: "", subject: "", body: "" });
    },
    onError: (e: any) => toast(e?.error?.detail ?? e?.message ?? "Ingest failed", "error"),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Inbox sync</h1>
        <p className="text-sm text-muted-foreground">Replies are classified deterministically — no paid email API (§36.2).</p>
      </header>

      {/* mailbox */}
      <Card className="p-5">
        <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Link2 className="h-4 w-4" /> Mailbox
        </h2>
        {mailbox.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : mailbox.data?.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500/12 text-orange-700 dark:text-orange-400">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{mailbox.data.items[0]?.address}</p>
                <p className="text-xs text-muted-foreground">last synced {fmt.ago(mailbox.data.items[0]?.last_synced_at)}</p>
              </div>
            </div>
            <Badge tone="mint">connected</Badge>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input placeholder="you@example.com" value={address} onChange={(e) => setAddress(e.target.value)} type="email" />
            <Button onClick={() => connect.mutate()} disabled={!address.includes("@") || connect.isPending}>
              Connect
            </Button>
          </div>
        )}
        <InlineBanner tone="info" className="mt-3" title="Free-tier reality">
          Local mode has no always-on IMAP poller. Paste a reply below (exported from your mail client, or a fixture) and it flows through
          the same classification → thread matching → status transition pipeline a worker would use.
        </InlineBanner>
      </Card>

      {/* ingest */}
      <Card className="space-y-3 p-5">
        <h2 className="font-display flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Inbox className="h-4 w-4" /> Ingest a message
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>From</Label>
            <Input placeholder="recruiter@company.com" value={msg.from} onChange={(e) => setMsg({ ...msg, from: e.target.value })} />
          </div>
          <div>
            <Label>Subject</Label>
            <Input placeholder="Re: Your application to Acme" value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Body</Label>
          <Textarea
            value={msg.body}
            onChange={(e) => setMsg({ ...msg, body: e.target.value })}
            placeholder={"Hi! We'd love to schedule a 30-min screen…\n\n— or paste an OOO / rejection / bounce"}
            className="min-h-[110px]"
          />
        </div>
        <Button onClick={() => ingest.mutate()} disabled={!msg.from || ingest.isPending}>
          <Send className="h-4 w-4" /> Classify & ingest
        </Button>
      </Card>

      {/* threads */}
      <Card className="p-5">
        <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <MessageSquare className="h-4 w-4" /> Threads
        </h2>
        {threads.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (threads.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No threads yet" description="Ingest a reply above — it will match to an application by subject and move the status." />
        ) : (
          <ul className="space-y-2">
            {threads.data!.items.map((t) => (
              <li key={t.id} className="rounded-xl border border-border">
                <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left" onClick={() => setOpenThread(openThread === t.id ? null : t.id)}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.company_name ?? "unmatched"} · {t.messages} message{t.messages === 1 ? "" : "s"} · {fmt.ago(t.last_message_at ?? t.created_at)}
                    </p>
                  </div>
                  <Badge tone={t.status === "interview" ? "orchid" : t.status === "rejected" ? "rose" : "neutral"} className="capitalize">
                    {t.status ?? "open"}
                  </Badge>
                </button>

                {openThread === t.id && (
                  <div className="space-y-2 border-t border-border p-3">
                    {threadDetail.isPending ? (
                      <Skeleton className="h-16 w-full" />
                    ) : (
                      (threadDetail.data?.messages ?? []).map((m: any) => (
                        <div key={m.id} className="rounded-xl bg-muted/60 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-semibold">
                              {m.direction === "out" ? "you" : m.from_addr} · {fmt.dateTime(m.received_at)}
                            </p>
                            <Badge tone={CLASS_TONE[m.classification] ?? "neutral"} className="capitalize">
                              {String(m.classification ?? "neutral").replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{String(m.body ?? "").slice(0, 500)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
