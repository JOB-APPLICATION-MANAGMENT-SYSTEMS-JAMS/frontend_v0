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
import { Building2, Copy, FileText, Globe, Mail, MapPin, Paperclip, Phone, RefreshCw, Rocket, Search, Send, Sparkles, Upload, X } from "lucide-react";
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
  country?: string | null;
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
  compose?: { score: number; checks: { label: string; pass: boolean; detail: string; weight: number }[]; category: string; variant: number };
};

type Attachment = { id: string; filename: string; url: string; size_bytes?: number };

type RescanProgress = {
  progress: {
    status: string;
    phase: string;
    pages_total: number;
    pages_done: number;
    pages_failed: number;
    pages_skipped: number;
    rows_found: number;
    rows_with_email: number;
    emails_found: number;
    errors: string[];
  };
  catalog: { lists_available: number; countries: number; by_sector: Record<string, number> };
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

  /**
   * Worldwide catalog walk (~1,200 contact lists, 188 countries): starts a background
   * rescan and polls its progress. This is the 10,000-company button.
   */
  const rescan = useMutation({
    mutationFn: (body: Record<string, any>) => appFetch<any>("/pitch-targets/rescan", { method: "POST", body, _auth: true }),
    onSuccess: (state) => toast(state.status === "running" ? "Rescan already running — progress below" : "Rescan started", "info"),
    onError: (e: any) => toast(e.detail ?? e.message ?? "Rescan failed to start", "error"),
  });

  const rescanState = useQuery<RescanProgress>({
    queryKey: ["pitch", "rescan"],
    queryFn: () => appFetch("/pitch-targets/rescan", { _auth: true }),
    refetchInterval: (q) => (q.state.data?.progress.status === "running" ? 2000 : false),
    staleTime: 1000,
  });
  const running = rescanState.data?.progress.status === "running";
  const catalog = rescanState.data?.catalog;

  /** fill rows that only have a website: visit the site, take the published inbox. */
  const enrich = useMutation({
    mutationFn: () => appFetch<any>("/pitch-targets/enrich", { method: "POST", body: { limit: 1000 }, _auth: true }),
    onSuccess: (r) => {
      toast(`${r.updated} emails discovered from company websites`, "success");
      list.refetch();
    },
    onError: (e: any) => toast(e.detail ?? e.message ?? "Enrichment failed", "error"),
  });

  // preview/edit the exact email before anything leaves the building
  const [draft, setDraft] = React.useState<(Prepared & { target: Target }) | null>(null);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);

  /** prepare (company + contact + tracked draft) → open the preview modal. */
  const prepare = useMutation({
    mutationFn: (t: Target) =>
      appFetch<Prepared>("/pitch-targets/prepare", { method: "POST", body: { external_id: t.external_id }, _auth: true }).then((p) => ({ ...p, target: t })),
    onSuccess: (p) => {
      setAttachments([]);
      setDraft(p);
    },
    onError: (e: any) => toast(e.detail ?? e.message ?? "Could not prepare the pitch", "error"),
  });

  /**
   * Refresh (§19.1): regenerate the wording. The backend composer is seeded — the
   * new seed picks a different opener, value props, CTA and sign-off, then runs the
   * grammar passes again, so every press is a genuinely different, still-clean email.
   */
  const rewrite = useMutation({
    mutationFn: (d: NonNullable<typeof draft>) =>
      appFetch<{ subject: string; body: string; score: number; checks: { label: string; pass: boolean; detail: string; weight: number }[]; category: string; variant: number }>(
        "/pitch-targets/rewrite",
        { method: "POST", body: { external_id: d.target.external_id, seed: `${Date.now()}`, kind: "pitch" }, _auth: true }
      ),
    onSuccess: (res, d) => {
      setDraft({ ...d, subject: res.subject, body: res.body, compose: { score: res.score, checks: res.checks, category: res.category, variant: res.variant } });
      toast(`Reworded · quality ${res.score}`, "success");
    },
    onError: (e: any) => toast(e.detail ?? e.message ?? "Could not reword the pitch", "error"),
  });

  /** CVs from CV Studio, offered as one-click attachments. */
  const cvs = useQuery({
    queryKey: ["cvs", "list"],
    queryFn: () => appFetch<{ items: { id: string; name: string }[] }>("/cvs", { _auth: true }),
    staleTime: 60 * 60 * 1000,
  });

  /** Upload a file (or a CV Studio document) and link it from the email body. */
  const attach = useMutation({
    mutationFn: (payload: { filename: string; content_type?: string; content_b64?: string; cv_id?: string }) =>
      appFetch<Attachment>("/pitch-targets/attach", { method: "POST", body: payload, _auth: true }),
    onSuccess: (a) => {
      setAttachments((prev) => [...prev, a]);
      setDraft((d) =>
        d ? { ...d, body: `${d.body.replace(/\s+$/, "")}\n\nAttachment: ${a.filename} — ${a.url}` }
        : d
      );
      toast(`${a.filename} linked into the email`, "success");
    },
    onError: (e: any) => toast(e.detail ?? e.message ?? "Upload failed", "error"),
  });

  const fileInput = React.useRef<HTMLInputElement | null>(null);

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      attach.mutate({
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        content_b64: dataUrl.split(",")[1] ?? "",
      });
    };
    reader.onerror = () => toast("Could not read that file", "error");
    reader.readAsDataURL(file);
  };

  /** Drop an attachment: removes the row and the line that linked it. */
  const detach = (a: Attachment) => {
    setAttachments((prev) => prev.filter((x) => x.id !== a.id));
    setDraft((d) => (d ? { ...d, body: d.body.replace(new RegExp(`\n*Attachment: ${a.filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} — [^\n]*`, ""), "") } : d));
  };

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
          {activeSector?.nationwide && (
            <>
              <Button
                variant="azure"
                size="sm"
                onClick={() => rescan.mutate({ scope: "all" })}
                disabled={running || rescan.isPending}
                title="Walk every contact list on lca.logcluster.org (about 1,200 pages across 188 countries) and store the companies"
              >
                <Globe className={cn("h-3.5 w-3.5", running && "animate-pulse")} /> {running ? "Ingesting…" : "Ingest worldwide lists"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => enrich.mutate()} disabled={enrich.isPending} title="Visit each company site and store its published inbox">
                <Mail className="h-3.5 w-3.5" /> Find missing emails
              </Button>
            </>
          )}
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
          {catalog && catalog.lists_available > 0 ? ` · catalog: ${catalog.lists_available} contact lists in ${catalog.countries} countries` : ""}
        </p>
        {(running || (rescanState.data?.progress.pages_done ?? 0) > 0) && rescanState.data && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <Badge tone={running ? "azure" : "mint"}>{running ? `ingesting ${rescanState.data.progress.phase}` : "last ingest done"}</Badge>
            <span className="text-muted-foreground">
              {rescanState.data.progress.pages_done}/{rescanState.data.progress.pages_total} pages · {rescanState.data.progress.rows_found.toLocaleString()} companies ·{" "}
              {rescanState.data.progress.rows_with_email.toLocaleString()} with a published email
              {rescanState.data.progress.emails_found ? ` · ${rescanState.data.progress.emails_found} found on websites` : ""}
              {rescanState.data.progress.pages_skipped ? ` · ${rescanState.data.progress.pages_skipped} skipped (fresh)` : ""}
            </span>
            {running && <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/3 animate-pulse bg-[image:var(--gradient-brand)]" /></div>}
            {rescanState.data.progress.errors.length > 0 && (
              <span className="text-rose-500">{rescanState.data.progress.errors.length} pages failed (retries are free)</span>
            )}
          </div>
        )}
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
                    <MapPin className="h-3 w-3" /> {t.country && t.country !== "Nigeria" ? `${t.city}, ${t.country}` : t.city}
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
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="pitch-subject">Subject</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rewrite.mutate(draft)}
                  disabled={rewrite.isPending}
                  title="Regenerate the wording: a fresh seeded variant, re-scored for grammar and impact"
                >
                  <Sparkles className={cn("h-3.5 w-3.5", rewrite.isPending && "animate-pulse")} /> {rewrite.isPending ? "Rewording…" : "Refresh wording"}
                </Button>
              </div>
              <Input id="pitch-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="pitch-body">Body</Label>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={fileInput}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.html"
                    onChange={(e) => {
                      onPickFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={attach.isPending} title="Attach a file to this email (linked for the recipient)">
                    <Paperclip className="h-3.5 w-3.5" /> File
                  </Button>
                  {(cvs.data?.items?.length ?? 0) > 0 && (
                    <Select
                      value=""
                      onChange={(e) => {
                        const cv = cvs.data?.items.find((c) => c.id === e.target.value);
                        if (cv) attach.mutate({ filename: `${cv.name}.html`, cv_id: cv.id });
                        e.target.value = "";
                      }}
                      aria-label="Attach a CV from CV Studio"
                    >
                      <option value="">Attach CV…</option>
                      {cvs.data!.items.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>
              <Textarea id="pitch-body" rows={12} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="resize-y font-mono text-xs leading-relaxed" />
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((a) => (
                  <span key={a.id} className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[11px]">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="max-w-[180px] truncate">{a.filename}</span>
                    <button onClick={() => detach(a)} aria-label={`Remove ${a.filename}`} className="text-muted-foreground hover:text-rose-500">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <a href={attachments[attachments.length - 1].url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-accent hover:underline">
                  <Upload className="h-3 w-3" /> preview link
                </a>
              </div>
            )}

            {draft.compose && (
              <details className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-[11px]">
                <summary className="cursor-pointer font-semibold">
                  Wording quality {draft.compose.score}/100 · “{draft.compose.category}” variant #{draft.compose.variant}
                </summary>
                <ul className="mt-1.5 space-y-0.5">
                  {draft.compose.checks.map((c) => (
                    <li key={c.label} className={cn("flex justify-between gap-3", c.pass ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400")}>
                      <span>
                        {c.pass ? "✓" : "·"} {c.label}
                      </span>
                      <span className="text-right opacity-80">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

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
