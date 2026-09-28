"use client";

/** Companies (§19.1 CRM-lite): tier-ranked targets, search, application counts. */
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Search, Users } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { Company } from "@/types";
import { Badge, Card, Input, Select, Skeleton } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";

const TIER_TONE = { dream: "orchid", reach: "azure", safety: "mint" } as const;

export default function CompaniesPage() {
  const [q, setQ] = React.useState("");
  const [tier, setTier] = React.useState("");
  const debounced = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    clearTimeout(debounced.current);
    debounced.current = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(debounced.current);
  }, [q]);

  const companies = useQuery<{ items: Company[] }>({
    queryKey: qk.companies({ q: query, tier }),
    queryFn: () => appFetch("/companies", { params: { q: query || undefined, tier: tier || undefined }, _auth: true }),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Companies</h1>
        <p className="text-sm text-muted-foreground">Pitch-target mode: rank the places you want, track who you know (§19.1).</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search companies…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-40" value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">All tiers</option>
          <option value="dream">Dream</option>
          <option value="reach">Reach</option>
          <option value="safety">Safety</option>
        </Select>
      </div>

      {companies.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : companies.error ? (
        <ErrorState error={companies.error} onRetry={() => companies.refetch()} />
      ) : (companies.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No companies yet"
          description="Companies appear when you capture a posting or add them from an application record."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {companies.data!.items.map((c, i) => (
            <Link key={c.id} href={`/companies/${c.id}`}>
              <Card className="animate-stagger h-full p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ ["--i" as any]: i }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-bold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.domain ?? "no domain"}</p>
                  </div>
                  <Badge tone={TIER_TONE[c.tier] ?? "neutral"} className="capitalize">
                    {c.tier}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> {c.applications ?? 0} applications
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {c.contacts ?? 0} contacts
                  </span>
                </div>
                {Array.isArray(c.stack) && c.stack.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.stack.slice(0, 5).map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
