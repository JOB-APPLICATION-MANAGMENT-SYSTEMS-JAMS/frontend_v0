"use client";

/** Tracker (§19.2): pipeline board with spring-ish moves + dense list mode + bulk ops + new-application modal. */
import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Columns3, List, Plus, X, Building2, CalendarClock, ExternalLink } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { AppStatus, Application, Paged } from "@/types";
import { Badge, Button, Card, Input, Label, Select, Skeleton } from "@/components/ui/base";
import { EmptyState, ErrorState, InlineBanner } from "@/components/ui/feedback";
import { BOARD_COLUMNS, STATUS_META, cn, fmt } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function TrackerPage() {
  return (
    <React.Suspense fallback={null}>
      <TrackerPageInner />
    </React.Suspense>
  );
}

function TrackerPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const view = params.get("view") ?? "board";
  const statusFilter = params.get("status");
  const newOpen = params.get("new") === "1";
  const [selected, setSelected] = React.useState<string[]>([]);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dropCol, setDropCol] = React.useState<string | null>(null);

  const listParams = { status: statusFilter ?? undefined, page_size: 100, sort: "recent" };
  const list = useQuery<Paged<Application>>({
    queryKey: qk.applicationList(listParams),
    queryFn: () => appFetch("/applications", { params: listParams as any, _auth: true }),
    staleTime: 15_000,
  });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppStatus }) => appFetch(`/applications/${id}/status`, { method: "POST", body: { status }, _auth: true }),
    meta: { invalidates: [["applications"], ["analytics"], ["streaks"], ["outreach"]] },
    onSuccess: (_d, v) => toast(`Moved to ${STATUS_META[v.status]?.label ?? v.status}`, "success"),
    onError: (e: any) => toast(e.detail ?? e.message ?? "Can’t move there", "error"),
  });

  const bulkMove = useMutation({
    mutationFn: (status: AppStatus) => appFetch("/applications/bulk-status", { method: "POST", body: { ids: selected, status }, _auth: true }),
    meta: { invalidates: [["applications"], ["analytics"], ["streaks"]] },
    onSuccess: () => {
      setSelected([]);
      toast("Bulk status applied", "success");
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  const byStatus = React.useMemo(() => {
    const map: Record<string, Application[]> = {};
    for (const c of BOARD_COLUMNS) map[c] = [];
    for (const a of list.data?.items ?? []) map[a.status]?.push(a);
    return map;
  }, [list.data]);

  const setParam = (k: string, v?: string) => {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    router.replace(`/tracker?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass-tab flex rounded-full p-0.5">
          <button onClick={() => setParam("view", "board")} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold", view === "board" ? "bg-[image:var(--gradient-brand)] text-white" : "text-muted-foreground")}>
            <Columns3 className="h-3.5 w-3.5" /> Board
          </button>
          <button onClick={() => setParam("view", "list")} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold", view === "list" ? "bg-[image:var(--gradient-brand)] text-white" : "text-muted-foreground")}>
            <List className="h-3.5 w-3.5" /> List
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone={statusFilter ? "neutral" : "azure"} className="cursor-pointer" onClick={() => setParam("status", undefined)}>
            all
          </Badge>
          {BOARD_COLUMNS.map((s) => (
            <Badge key={s} tone={statusFilter === s ? "azure" : "neutral"} className="cursor-pointer capitalize" onClick={() => setParam("status", statusFilter === s ? undefined : s)}>
              {STATUS_META[s].label} · {byStatus[s]?.length ?? 0}
            </Badge>
          ))}
        </div>

        <Button className="ml-auto" onClick={() => setParam("new", "1")}>
          <Plus className="h-4 w-4" /> Log application <span className="ml-1 hidden opacity-70 sm:inline">c</span>
        </Button>
      </div>

      {selected.length > 0 && (
        <InlineBanner tone="info" title={`${selected.length} selected`}>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BOARD_COLUMNS.map((s) => (
              <Button key={s} size="sm" variant="outline" onClick={() => bulkMove.mutate(s)} className="capitalize">
                {STATUS_META[s].label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </InlineBanner>
      )}

      {list.isPending ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="h-32 p-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
              <Skeleton className="mt-4 h-6 w-1/3" />
            </Card>
          ))}
        </div>
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (list.data?.items?.length ?? 0) === 0 ? (
        <EmptyState
          title="Nothing tracked yet"
          description="Capture a posting by URL, track one from Discover, or log an application manually — every record gets a status, a date and a next action."
          action={
            <div className="flex gap-2">
              <Button onClick={() => setParam("new", "1")}>
                <Plus className="h-4 w-4" /> Log application
              </Button>
              <Button variant="azure" onClick={() => router.push("/capture")}>
                Capture a URL
              </Button>
            </div>
          }
        />
      ) : view === "list" ? (
        <ListView items={list.data!.items} selected={selected} onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
      ) : (
        /* ─────────── board ─────────── */
        <div className="grid gap-3 overflow-x-auto pb-4 md:grid-cols-3 xl:grid-cols-4 [grid-auto-flow:column] [grid-auto-columns:minmax(240px,1fr)]">
          {BOARD_COLUMNS.map((col) => (
            <section
              key={col}
              onDragOver={(e) => {
                e.preventDefault();
                setDropCol(col);
              }}
              onDragLeave={() => setDropCol(null)}
              onDrop={() => {
                if (dragId) move.mutate({ id: dragId, status: col });
                setDragId(null);
                setDropCol(null);
              }}
              className={cn("glass-card min-h-[220px] rounded-2xl p-3 transition-shadow", dropCol === col && "ring-2 ring-orange-500/70")}
            >
              <header className="mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: STATUS_META[col].color }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[col].color }} />
                  {STATUS_META[col].label}
                </span>
                <span className="tnum text-xs font-bold text-muted-foreground">{byStatus[col]?.length ?? 0}</span>
              </header>

              <div className="space-y-2">
                {(byStatus[col] ?? []).slice(0, 12).map((a, i) => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={() => setDragId(a.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "animate-stagger cursor-grab rounded-xl border border-white/40 bg-white/60 p-2.5 transition-transform duration-200 hover:-translate-y-0.5 active:cursor-grabbing dark:border-white/10 dark:bg-black/30",
                      dragId === a.id && "opacity-50",
                      ["interview", "offer"].includes(a.status) && "border-orange-400/50"
                    )}
                    style={{ ["--i" as any]: Math.min(i, 6) }}
                  >
                    <Link href={`/applications/${a.id}`} className="block">
                      <p className="truncate text-[13px] font-semibold leading-tight">{a.role_title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{a.company_name}</p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Badge tone={a.kind === "pitch" ? "orchid" : "neutral"} className="px-1.5 py-0">
                          {a.kind}
                        </Badge>
                        <span className="flex items-center gap-0.5">
                          <CalendarClock className="h-3 w-3" />
                          {fmt.ago(a.applied_at ?? a.created_at)}
                        </span>
                        {a.url && <ExternalLink className="ml-auto h-3 w-3" />}
                      </div>
                    </Link>
                  </div>
                ))}
                {(byStatus[col] ?? []).length > 12 && <p className="text-center text-[11px] text-muted-foreground">+{(byStatus[col] ?? []).length - 12} more — use list view</p>}
              </div>
            </section>
          ))}
        </div>
      )}

      {newOpen && <NewApplicationModal onClose={() => setParam("new", undefined)} />}
    </div>
  );
}

/* ------------------------------- list view ------------------------------- */
function ListView({ items, selected, onToggle }: { items: Application[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[840px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="w-10 px-4 py-3" />
            <th className="px-2 py-3 font-semibold">Role</th>
            <th className="px-2 py-3 font-semibold">Company</th>
            <th className="px-2 py-3 font-semibold">Status</th>
            <th className="px-2 py-3 font-semibold">Source</th>
            <th className="px-2 py-3 font-semibold">Applied</th>
            <th className="px-2 py-3 font-semibold">Reply</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((a, i) => (
            <tr key={a.id} className="animate-stagger border-b border-border/40 last:border-0 hover:bg-muted/50" style={{ ["--i" as any]: Math.min(i, 10) }}>
              <td className="px-4 py-2.5">
                <input type="checkbox" checked={selected.includes(a.id)} onChange={() => onToggle(a.id)} className="accent-orange-600" />
              </td>
              <td className="max-w-[240px] truncate px-2 py-2.5 font-medium">
                <Link href={`/applications/${a.id}`} className="hover:text-accent">
                  {a.role_title}
                </Link>
              </td>
              <td className="max-w-[160px] truncate px-2 py-2.5 text-muted-foreground">{a.company_name}</td>
              <td className="px-2 py-2.5">
                <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize" style={{ color: STATUS_META[a.status]?.color, borderColor: `${STATUS_META[a.status]?.color}55` }}>
                  {STATUS_META[a.status]?.label ?? a.status}
                </span>
              </td>
              <td className="px-2 py-2.5 text-xs capitalize text-muted-foreground">{a.source ?? "—"}</td>
              <td className="tnum px-2 py-2.5 text-xs text-muted-foreground">{fmt.date(a.applied_at ?? a.created_at)}</td>
              <td className="px-2 py-2.5 text-xs">{a.first_reply_days != null ? `${a.first_reply_days}d` : a.replied_at ? "✓" : "—"}</td>
              <td className="px-4 py-2.5 text-right">
                <Link href={`/applications/${a.id}`} className="text-xs font-semibold text-accent hover:underline">
                  open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* -------------------------- new application modal ------------------------- */
function NewApplicationModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = React.useState({ company_name: "", role_title: "", url: "", kind: "application", notes: "" });

  const create = useMutation({
    mutationFn: () => appFetch<any>("/applications", { method: "POST", body: { ...form, url: form.url || null }, _auth: true }),
    meta: { invalidates: [["applications"], ["analytics"], ["streaks"]] },
    onSuccess: (data) => {
      toast("Application logged", "success");
      onClose();
      router.push(`/applications/${data.id}`);
    },
    onError: (e: any) => toast(e.message ?? "Couldn’t create", "error"),
  });

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="glass-panel route-fade w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Log an application</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Company *</Label>
              <Input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Northwind Pay" />
            </div>
            <div>
              <Label>Role *</Label>
              <Input required value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} placeholder="Backend Engineer" />
            </div>
          </div>
          <div>
            <Label>Posting URL</Label>
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
          </div>
          <div>
            <Label>Kind</Label>
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="application">Application — a posting exists</option>
              <option value="pitch">Pitch — no opening (cold outreach)</option>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="referral from X · tailored CV v2" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Create"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
