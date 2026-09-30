"use client";

/**
 * Pitch targets (§19.1 mode 2): companies that probably have no software opening
 * but still need software help. Live from OpenStreetMap via /pitch-targets, with
 * the official email surfaced (published or derived) because that is what the
 * pitch is sent to. One click prepares the draft and auto-sends it (SMTP) or
 * opens the Gmail compose hand-off; the company site link stays for manual work.
 */
import * as React from "react";
import { useMutation, useQuery, keepPreviousData } from "@tanstack/react-query";
import { Building2, Copy, Mail, MapPin, Phone, RefreshCw, Rocket, Search, Globe } from "lucide-react";
import { appFetch } from "@/lib/api";
import { Badge, Button, Card, Input, Select, Skeleton } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { InfoButton } from "@/components/ui/modal";
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
    queryFn: () => appFetch<{ sectors: { key: string; label: string }[]; cities: { key: string; label: string }[] }>("/pitch-targets/meta", { _auth: true }),
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

  /** prepare (company + contact + draft pitch) → auto-apply sends it or opens compose. */
  const pitch = useMutation({
    mutationFn: async (t: Target) => {
      const prepared = await appFetch<{ application_id: string; contact: { email: string } }>("/pitch-targets/" + encodeURIComponent(t.external_id) + "/prepare", { method: "POST", body: {}, _auth: true });
      const res = await appFetch<{ mode: "sent" | "compose" | "open"; compose_url?: string; email?: string }>(`/applications/${prepared.application_id}/auto-apply`, { method: "POST", body: {}, _auth: true });
      return { ...res, company: t.name };
    },
    meta: { invalidates: [["applications"], ["outreach"], ["streaks"], ["analytics"]] },
    onSuccess: (res) => {
      if (res.mode === "sent") toast(`Pitch sent to ${res.email}`, "success");
      else if (res.mode === "compose" && res.compose_url) {
        window.open(res.compose_url, "_blank", "noopener");
        toast("Gmail compose opened; press Send there", "info");
      } else toast("No email found; opened the company site", "info");
    },
    onError: (e: any) => toast(e.detail ?? e.message ?? "Could not prepare the pitch", "error"),
  });

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
          <Button variant="outline" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className={cn("h-3.5 w-3.5", refresh.isPending && "animate-spin")} /> Rescan
          </Button>
          <InfoButton
            title="Pitch targets"
            body={
              <>
                <p>Companies that rarely post a software opening but still need software: supermarkets, airports, manufacturers and offices across Lagos, Abuja and Ogun.</p>
                <p>
                  Data is live from OpenStreetMap, refreshed daily. The email shown is the published contact when there is one, otherwise a derived <b>info@domain</b> guess flagged as such. Pitching creates a tracked application just like a normal one, and replies land in your Inbox.
                </p>
              </>
            }
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {list.data ? `${list.data.pagination.total_count} companies to pitch` : "searching live sources…"} · source: OpenStreetMap Overpass
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
                <Button size="sm" variant="azure" onClick={() => pitch.mutate(t)} disabled={!t.email || (pitch.isPending && pitch.variables?.external_id === t.external_id)} title={t.email ? "Send the pitch email now" : "No email known yet: use find email, then capture the page"}>
                  <Rocket className="h-3.5 w-3.5" /> Pitch this company
                </Button>
                {t.website && (
                  <a href={t.website} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                    <Building2 className="h-3.5 w-3.5" /> Open
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
