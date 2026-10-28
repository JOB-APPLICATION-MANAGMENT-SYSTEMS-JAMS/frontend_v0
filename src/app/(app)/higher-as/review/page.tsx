"use client";

/**
 * The platform reviewer's queue.
 *
 * Two jobs only: read the document a professional submitted, and decide whether a
 * customer review broke the rules. Nothing here can edit a rating, and a reviewer
 * cannot verify their own credential - the API reads the account role, not a
 * checkbox on this page.
 */
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, FileText, ShieldCheck, X } from "lucide-react";
import { appFetch } from "@/lib/api";
import { Badge, Button, Card, Chip, Input, Skeleton, Textarea } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { toast } from "@/hooks/use-toast";

type QueueCredential = {
  id: string;
  pro_id: string;
  pro_name: string;
  trade_label: string;
  kind: string;
  title: string;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  document_name: string | null;
  has_document: boolean;
  submitted_at: string;
};

type QueueReview = {
  id: string;
  pro_name: string;
  trade_label: string;
  customer_name: string;
  rating: number;
  body: string;
  verified: boolean;
  dispute_reason: string;
  response: string | null;
  created_at: string;
};

export default function VerificationQueuePage() {
  const [tab, setTab] = React.useState<"credentials" | "reviews">("credentials");
  const [note, setNote] = React.useState("");

  const credentials = useQuery<{ items: QueueCredential[] }>({
    queryKey: ["higher-as", "queue", "credentials"],
    queryFn: () => appFetch("/higher-as/credentials/queue", { _auth: true }),
  });
  const reviews = useQuery<{ items: QueueReview[] }>({
    queryKey: ["higher-as", "queue", "reviews"],
    queryFn: () => appFetch("/higher-as/moderation", { _auth: true }),
  });

  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "verified" | "rejected" }) =>
      appFetch(`/higher-as/credentials/${id}/review`, { method: "POST", body: { decision, note: note.trim() || undefined }, _auth: true }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Could not record the decision" },
    onSuccess: (_d, v) => {
      toast(v.decision === "verified" ? "Marked verified" : "Rejected", "success");
      setNote("");
    },
  });

  const moderate = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: "upheld" | "dismissed" }) =>
      appFetch(`/higher-as/reviews/${id}/moderate`, { method: "POST", body: { outcome, note: note.trim() || undefined }, _auth: true }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Could not record the outcome" },
    onSuccess: (_d, v) => {
      toast(v.outcome === "upheld" ? "Review hidden from public totals" : "Review kept", "success");
      setNote("");
    },
  });

  const openDocument = async (id: string) => {
    try {
      const doc = await appFetch<{ filename: string; b64: string }>(`/higher-as/credentials/${id}/document`, { _auth: true });
      const bytes = Uint8Array.from(atob(doc.b64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes]));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast("No document attached to this submission", "error");
    }
  };

  const denied = (credentials.error as { status?: number } | null)?.status === 403;

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="Higher As · moderation"
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        title="Verification queue"
        description="Decide what JAMS has actually checked: a credential is verified only against a document a reviewer has read, and a review is hidden only when a dispute is upheld."
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={tab === "credentials"} onClick={() => setTab("credentials")}>
          Credentials {(credentials.data?.items.length ?? 0) > 0 ? <span className="opacity-60">{credentials.data?.items.length}</span> : null}
        </Chip>
        <Chip active={tab === "reviews"} onClick={() => setTab("reviews")}>
          Disputed reviews {(reviews.data?.items.length ?? 0) > 0 ? <span className="opacity-60">{reviews.data?.items.length}</span> : null}
        </Chip>
      </div>

      {denied ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Reviewer access required"
          description="Credential verification is limited to platform reviewers. Ask an administrator to set your account role to admin."
        />
      ) : tab === "credentials" ? (
        credentials.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : credentials.error ? (
          <ErrorState error={credentials.error} onRetry={() => credentials.refetch()} />
        ) : (credentials.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Nothing waiting" description="Every submitted credential has a decision. New submissions appear here in arrival order." />
        ) : (
          <div className="space-y-3">
            <Card className="p-3">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="review-note">Decision note (optional, shown to the professional)</label>
              <Input id="review-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Checked against the NATA register on 28 Oct." className="mt-1" />
            </Card>
            {credentials.data!.items.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.pro_name} · {c.trade_label} · {c.kind}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {[c.issuer, c.issued_on ? `issued ${c.issued_on}` : null, c.expires_on ? `expires ${c.expires_on}` : null].filter(Boolean).join(" · ") || "No issuer or dates supplied"}
                    </p>
                  </div>
                  <Badge tone="amber">pending</Badge>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {c.has_document ? (
                    <Button size="sm" variant="outline" onClick={() => openDocument(c.id)}>
                      <FileText className="h-3.5 w-3.5" /> {c.document_name ?? "Open document"}
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">No document attached - check the reference before deciding.</span>
                  )}
                  <Button size="sm" variant="azure" onClick={() => review.mutate({ id: c.id, decision: "verified" })} disabled={review.isPending}>
                    <Check className="h-3.5 w-3.5" /> Verify
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => review.mutate({ id: c.id, decision: "rejected" })} disabled={review.isPending}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                  <span className="ml-auto text-[10px] text-muted-foreground">submitted {c.submitted_at.slice(0, 10)}</span>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : reviews.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : reviews.error ? (
        <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
      ) : (reviews.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No open disputes" description="A disputed review keeps its rating and stays visible until a reviewer records an outcome." />
      ) : (
        <div className="space-y-3">
          <Card className="p-3">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="moderation-note">Moderation note (optional)</label>
            <Textarea id="moderation-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this outcome." className="mt-1" />
          </Card>
          {reviews.data!.items.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold">{r.customer_name}</span>
                <span className="text-[11px] text-muted-foreground">{r.rating}/5</span>
                {r.verified && <Badge tone="mint">confirmed job</Badge>}
                <span className="ml-auto text-[10px] text-muted-foreground">about {r.pro_name}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed">{r.body}</p>
              <div className="mt-2 rounded-xl border border-border bg-muted/40 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Professional&apos;s reason for review</p>
                <p className="mt-0.5 text-[12px]">{r.dispute_reason}</p>
              </div>
              {r.response && <p className="mt-2 border-l-2 border-ember/50 pl-2 text-[12px] text-muted-foreground">{r.response}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" variant="azure" onClick={() => moderate.mutate({ id: r.id, outcome: "upheld" })} disabled={moderate.isPending}>
                  Uphold - hide from public totals
                </Button>
                <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: r.id, outcome: "dismissed" })} disabled={moderate.isPending}>
                  Dismiss - keep the review
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
