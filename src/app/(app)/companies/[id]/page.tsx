"use client";

/** Company record (§19.1): contacts, applications, notes, careers link. */
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Mail, Phone, Users } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { Application, Company } from "@/types";
import { Badge, Button, Card, Skeleton } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { STATUS_META, fmt } from "@/lib/utils";

type CompanyDetail = Company & { contacts: any[]; applications: Application[] };

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const company = useQuery<CompanyDetail>({
    queryKey: qk.company(id),
    queryFn: () => appFetch(`/companies/${id}`, { _auth: true }),
    enabled: !!id,
  });

  if (company.isPending) return <Skeleton className="h-96 w-full" />;
  if (company.error) return <ErrorState error={company.error} onRetry={() => company.refetch()} />;
  const c = company.data!;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Companies
      </button>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold">{c.name}</h1>
            <p className="text-sm text-muted-foreground">{c.domain ?? "n/a"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={c.tier === "dream" ? "orchid" : c.tier === "reach" ? "azure" : "mint"} className="capitalize">
              {c.tier}
            </Badge>
            {c.careers_url && (
              <a href={c.careers_url} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-3.5 w-3.5" /> Careers page
                </Button>
              </a>
            )}
          </div>
        </div>

        {Array.isArray(c.stack) && c.stack.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.stack.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        )}
        {c.notes && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-sm">{c.notes}</p>}
      </Card>

      <Card className="p-5">
        <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Users className="h-4 w-4" /> Contacts
        </h2>
        {c.contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts yet, add them from an outreach thread once someone replies.</p>
        ) : (
          <ul className="space-y-2">
            {c.contacts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name ?? p.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.title ?? ""}</p>
                </div>
                {p.email && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {p.email}
                  </span>
                )}
                {p.phone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {p.phone}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Applications ({c.applications.length})</h2>
        {c.applications.length === 0 ? (
          <EmptyState title="Nothing here yet" description="Applications linked to this company show up automatically." />
        ) : (
          <ul className="space-y-2">
            {c.applications.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.role_title}</p>
                  <p className="text-xs text-muted-foreground">applied {fmt.date(a.applied_at ?? a.created_at)}</p>
                </div>
                <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize" style={{ color: STATUS_META[a.status]?.color, borderColor: `${STATUS_META[a.status]?.color}66`, background: `${STATUS_META[a.status]?.color}14` }}>
                  {STATUS_META[a.status]?.label}
                </span>
                <Button size="sm" variant="ghost" onClick={() => router.push(`/applications/${a.id}`)}>
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
