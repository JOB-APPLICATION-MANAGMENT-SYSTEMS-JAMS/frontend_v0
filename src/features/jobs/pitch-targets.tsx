"use client";

/**
 * Pitch targets (§19.1 mode 2): companies that probably have no software opening
 * but still need software help. Live sources (OpenStreetMap, curated nationwide
 * contact lists, optional Stargate) via /pitch-targets, with the official email
 * surfaced (published or derived). One click opens a preview of the exact email:
 * edit it, then send (SMTP when connected, Gmail compose hand-off otherwise);
 * every pitch stays a tracked application.
 */
import * as React from "react";
import { useMutation, useQuery, keepPreviousData } from "@tanstack/react-query";
import { Building2, Copy, Mail, MapPin, Phone, RefreshCw, Rocket, Search, Globe, Send, X } from "lucide-react";
import { appFetch } from "@/lib/api";
import { Badge, Button, Card, Input, Label, Select, Skeleton, Textarea } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { InfoButton, Modal } from "@/components/ui/modal";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Target = {
  external_id: string;
  name: string;
  sector: string;
  city: string | null;
  website: string | null;
  email: string | null;
  email_derived: number;
  phone: string | null;
};

/** POST /pitch-targets/prepare answer: the draft email + everything needed to send it. */
type Prepared = {
  application_id: string;
  outreach_id: string;
  subject: string;
  body: string;
  smtp_ready: boolean;
  contact: { email: string; email_derived: boolean };
};

export function PitchTargets({ className }: { className?: string }) {
  const [sector, setSector] = React.useState("supermarket");
  const [city, setCity] = React.useState("lagos");
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const meta = useQuery({
    queryKey: ["pitch", "meta"],
    queryFn: () =>
      appFetch<{ sectors: { key: string; label: string; source: string; nationwide: boolean }[]; cities: { key: string; label: string }[] }>("/pitch-targets/meta", { _auth: true }),
    staleTime: 60 * 60 * 1000,
  });

  const list = useQuery({
    queryKey: ["pitch", sector, city, debouncedQ],
    queryFn: () => appFetch<{ items: Target[]; pagination: { total_count: number } }>("/pitch-targets", { params: { sector, city, q: debouncedQ || undefined, page_size: 50 }, _auth: true }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const refresh = useMutation({
    mutationFn: () => appFetch<any>("/pitch-targets", { params: { sector, city, refresh: "1" }, _auth: true }),
    onSuccess: () => {
      toast("Re-scanned live sources", "success");
      list.refetch();
    },
    onError: (e: any) => toast(e.detail ?? e.message ?? "Refresh failed", "error"),
  });

  // preview/edit the exact email before anything leaves the building
  const [draft, setDraft] = React.useState<(Prepared & { target: Target }) | null>(null);

  /** prepare (company + contact + tracked draft) → open the preview modal. */
  const prepare = useMutation({
    mutationFn: (t: Target) =>
      appFetch<Prepared>("/pitch-targets/prepare", { method: "POST", body: { external_id: t.external_id }, _auth: true }).then((p) => ({ ...p, target: t })),
    onSuccess: (p) => setDraft(p),
    onError: (e: any) => toast(e.detail ?? e.message ?? "Could not prepare the pitch", "error"),
  });

  /** save the edited draft, then send: SMTP directly, or Gmail compose hand-off. */
  const send = useMutation({
    mutationFn: async (d: NonNullable<typeof draft>) => {
      await appFetch(`/outreach/${d.outreach_id}`, { method: "PUT", body: { subject: d.subject, body: d.body }, _auth: true });
      const res = await appFetch<{ mode: "sent" | "compose" | "open"; compose_url?: string; email?: string }>(`/applications/${d.application_id}/auto-apply`, { method: "POST", body: {}, _auth: true });
      return { ...res, company: d.target.name };
    },
    meta: { invalidates: [["applications"], ["outreach"], ["streaks"], ["analytics"]] },
    onSuccess: (res) => {
      setDraft(null);
      if (res.mode === "sent") toast(`Pitch sent to ${res.email}`, "success");
      else if (res.mode === "compose" && res.compose_url) {
        window.open(res.compose_url, "_blank", "noopener");
        toast("Gmail compose opened; press Send there", "info");
      } else toast("No email found; opened the company site", "info");
    },
    onError: (e: any) => toast(e.detail ?? e.message ?? "Could not send the pitch", "error"),
  });

  const activeSector = meta.data?.sectors.find((s) => s.key === sector);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast("Email copied", "success");
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="glass-sheet rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by company name…" className="pl-9" />
          </div>
          <Select value={sector} onChange={(e) => setSector(e.target.value)}>
            {(meta.data?.sectors ?? [{ key: "supermarket", label: "Supermarkets & retail" }]).map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          {!activeSector?.nationwide && (
            <Select value={city} onChange={(e) => setCity(e.target.value)}>
              {(meta.data?.cities ?? [
                { key: "lagos", label: "Lagos" },
                { key: "abuja", label: "Abuja (FCT)" },
                { key: "ogun", label: "Ogun" },
              ]).map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
              <option value="all">All cities</option>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className={cn("h-3.5 w-3.5", refresh.isPending && "animate-spin")} /> Rescan
          </Button>
          <InfoButton
            title="Pitch targets"
            body={
              <>
                <p>Companies that rarely post a software opening but still need software: supermarkets, airports, manufacturers and offices across Lagos, Abuja and Ogun.</p>
                <p>
                  Data is live from OpenStreetMap plus nationwide contact lists (airlines, ports) and any connected company-data provider. The email shown is the published contact when there is one, otherwise a derived <b>info@domain</b> guess flagged as such. Pitching creates a tracked application just like a normal one, you preview and can edit the email before it goes out, and replies land in your Inbox.
                </p>
              </>
            }
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {list.data ? `${list.data.pagination.total_count} companies to pitch` : "searching live sources…"} · source: {activeSector?.source ?? "OpenStreetMap Overpass"}
        </p>
      </div>

      {list.isPending ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-40 p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-3 h-3 w-1/2" />
              <Skeleton className="mt-4 h-8 w-full" />
            </Card>
          ))}
        </div>
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (list.data?.items?.length ?? 0) === 0 ? (
        <EmptyState title="No companies matched" description="Try another sector or city, or hit Rescan to refresh the live data." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.data!.items.map((t, i) => (
            <Card key={t.external_id} className="animate-stagger flex flex-col gap-2.5 p-4" style={{ ["--i" as any]: Math.min(i, 8) }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold">{t.name}</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {t.city}
                  </p>
                </div>
                <Badge tone="neutral" className="capitalize">
                  {t.sector}
                </Badge>
              </div>

              {t.email ? (
                <button onClick={() => copy(t.email!)} className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-left text-xs hover:border-foreground/30" title="Click to copy">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{t.email}</span>
                  <Copy className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
                  {t.email_derived ? <Badge tone="amber">derived</Badge> : <Badge tone="mint">published</Badge>}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground">No email found for this company</p>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {t.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {t.phone}
                  </span>
                )}
                {t.website ? (
                  <a href={t.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-accent">
                    <Globe className="h-3 w-3" /> site
                  </a>
                ) : (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(`"${t.name}" contact email`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-accent hover:underline"
                    title="No website on record: search for the official inbox, then capture the page to store it"
                  >
                    <Search className="h-3 w-3" /> find email
                  </a>
                )}
              </div>

              <div className="mt-auto flex items-center gap-2 pt-1">
                <Button size="sm" variant="azure" onClick={() => prepare.mutate(t)} disabled={!t.email || (prepare.isPending && prepare.variables?.external_id === t.external_id)} title={t.email ? "Preview the pitch email, edit it, then send" : "No email known yet: use find email, then capture the page"}>
                  <Rocket className="h-3.5 w-3.5" /> Pitch this company
                </Button>
                {t.website && (
                  <a href={t.website} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                    <Building2 className="h-3.5 w-3.5" /> Open
                  </a>
                )}
              </div>
            </Card>
          )          )}
        </div>
      )}

      <Modal open={!!draft} onClose={() => !send.isPending && setDraft(null)} label="Preview pitch email" className="max-w-2xl">
        {draft && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-base font-bold">Preview: pitch to {draft.target.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  To: {draft.contact.email} {draft.contact.email_derived ? "(derived guess, verify before sending)" : "(published contact)"}
                </p>
              </div>
              <button onClick={() => setDraft(null)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pitch-subject">Subject</Label>
              <Input id="pitch-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pitch-body">Body</Label>
              <Textarea id="pitch-body" rows={12} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="resize-y font-mono text-xs leading-relaxed" />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {draft.smtp_ready ? (
                <span>
                  SMTP connected: the email is sent <b>automatically</b> when you press send, no other step.
                </span>
              ) : (
                <span>
                  Gmail hand-off: pressing send opens a prefilled Gmail compose tab. Connect Gmail (app password in Inbox & Sync) once and sends become fully automatic.
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              This pitch is tracked like any application: status, opens and replies show up in Tracker and Inbox.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setDraft(null)} disabled={send.isPending}>
                Cancel
              </Button>
              <Button size="sm" variant="azure" onClick={() => send.mutate(draft)} disabled={send.isPending || !draft.subject.trim() || !draft.body.trim()}>
                <Send className="h-3.5 w-3.5" /> {send.isPending ? "Sending…" : draft.smtp_ready ? "Send pitch now" : "Open Gmail compose"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
