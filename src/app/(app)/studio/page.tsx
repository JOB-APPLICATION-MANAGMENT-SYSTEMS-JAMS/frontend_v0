"use client";

/** CV Studio (§24): versioned CVs per archetypes, forking, template library, print pipeline. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Copy, Eye, FilePlus2, FileText, Printer, RefreshCw, Trash2, X } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { CV, Template } from "@/types";
import { Badge, Button, Card, Input, Label, Select, Skeleton } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { toast } from "@/hooks/use-toast";
import { fmt } from "@/lib/utils";

export default function StudioPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [archetype, setArchetype] = React.useState<"opening" | "pitch">("opening");
  const [category, setCategory] = React.useState("");

  const cvs = useQuery<{ items: CV[] }>({
    queryKey: qk.cvs(),
    queryFn: () => appFetch("/cvs", { _auth: true }),
  });

  const templates = useQuery<{ items: Template[] }>({
    queryKey: qk.templates({ kind: "cv" }),
    queryFn: () => appFetch("/templates", { params: { kind: "cv" }, _auth: true }),
  });

  const create = useMutation({
    mutationFn: () =>
      appFetch<CV>("/cvs", {
        method: "POST",
        body: {
          name: name.trim() || `${archetype === "opening" ? "Opening" : "Pitch"} CV`,
          archetype,
          career_category: category.trim() || undefined,
          // profile-sourced blocks stay in sync with the Profile page (§24.1)
          blocks: [
            { type: "summary", source: "profile" },
            { type: "experience", source: "profile" },
            { type: "skills", source: "profile" },
            { type: "education", source: "profile" },
          ],
        },
        _auth: true,
      }),
    meta: { invalidates: [["cvs"]] },
    onSuccess: (cv) => {
      toast("CV created — tailor it in the editor", "success");
      router.push(`/studio/cvs/${cv.id}`);
    },
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => appFetch<CV>(`/cvs/${id}/duplicate`, { method: "POST", _auth: true }),
    meta: { invalidates: [["cvs"]] },
    onSuccess: (cv) => toast(`Forked → “${cv.name}”`, "success"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => appFetch(`/cvs/${id}`, { method: "DELETE", _auth: true }),
    meta: { invalidates: [["cvs"]] },
    onSuccess: () => toast("CV deleted", "info"),
  });

  // fullscreen A4 preview — openable straight from a CV card
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState("");
  const [previewBusy, setPreviewBusy] = React.useState(false);

  const loadPreview = React.useCallback(async (id: string) => {
    setPreviewBusy(true);
    try {
      const html = await appFetch<string>(`/cvs/${id}/html`, { _auth: true });
      setPreviewHtml(typeof html === "string" ? html : String(html));
    } catch {
      toast("Preview failed to render", "error");
    } finally {
      setPreviewBusy(false);
    }
  }, []);

  const openPreview = (id: string) => {
    setPreviewId(id);
    setPreviewHtml("");
    void loadPreview(id);
  };

  React.useEffect(() => {
    if (!previewId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewId]);

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">CV Studio</h1>
          <p className="text-sm text-muted-foreground">
            One CV per archetype, forked per application — never mutate the master (§24.1).
          </p>
        </div>
      </header>

      {/* create */}
      <Card className="p-5">
        <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">New CV</h2>
        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-end">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Frontend — Series A SaaS" />
          </div>
          <div>
            <Label>Archetype</Label>
            <Select value={archetype} onChange={(e) => setArchetype(e.target.value as any)}>
              <option value="opening">Opening (broad, ATS-safe)</option>
              <option value="pitch">Pitch (tailored, dense)</option>
            </Select>
          </div>
          <div>
            <Label>Career category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="frontend, data, pm…" />
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <FilePlus2 className="h-4 w-4" /> Create
          </Button>
        </div>
      </Card>

      {/* CV grid */}
      {cvs.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : cvs.error ? (
        <ErrorState error={cvs.error} onRetry={() => cvs.refetch()} />
      ) : (cvs.data?.items?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No CVs yet"
          description="Create your first one — profile blocks stay linked to the Profile page, local blocks are yours to tailor."
          action={<Button onClick={() => create.mutate()}>Create from profile</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cvs.data!.items.map((cv, i) => (
            <Card key={cv.id} className="animate-stagger flex flex-col p-4" style={{ ["--i" as any]: i }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-bold">{cv.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{cv.career_category || "uncategorized"}</p>
                </div>
                <Badge tone={cv.archetype === "pitch" ? "orchid" : "azure"} className="capitalize">
                  {cv.archetype}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(cv.targeting?.keywords ?? []).slice(0, 4).map((k) => (
                  <Badge key={k}>{k}</Badge>
                ))}
                {cv.lineage?.forked_from && <Badge tone="amber">fork</Badge>}
              </div>

              <p className="mt-3 text-[11px] text-muted-foreground">updated {fmt.ago(cv.updated_at)} · {cv.blocks.length} blocks</p>

              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <Button size="sm" className="flex-1" onClick={() => router.push(`/studio/cvs/${cv.id}`)}>
                  Edit
                </Button>
                <Button size="sm" variant="outline" title="A4 preview" onClick={() => openPreview(cv.id)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" title="Open print view (Save as PDF)" onClick={() => router.push(`/studio/cvs/${cv.id}?print=1`)}>
                  <Printer className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" title="Fork this CV" onClick={() => duplicate.mutate(cv.id)} disabled={duplicate.isPending}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" title="Delete" onClick={() => remove.mutate(cv.id)} disabled={remove.isPending}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* template library */}
      <Card className="p-5">
        <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">CV templates</h2>
        {templates.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : (templates.data?.items?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No templates yet — seed one from Settings → Export or write your own in Outreach.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {templates.data!.items.map((t) => (
              <li key={t.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <Badge tone="mint" className="capitalize">
                    {t.archetype}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{t.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </div>

      {/* fullscreen A4 preview — opened from a CV card */}
      {previewId && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="A4 preview"
        >
          <div className="flex h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/10 px-4 py-2.5">
              <span className="truncate font-display text-sm font-bold text-neutral-900">
                A4 preview{cvs.data?.items.find((c) => c.id === previewId)?.name ? ` — ${cvs.data!.items.find((c) => c.id === previewId)!.name}` : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadPreview(previewId)}
                  disabled={previewBusy}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${previewBusy ? "animate-spin" : ""}`} /> Refresh
                </button>
                <button
                  type="button"
                  aria-label="Close preview"
                  onClick={() => setPreviewId(null)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-neutral-200 p-3">
              {previewHtml ? (
                <iframe title="A4 preview" srcDoc={previewHtml} className="h-full w-full rounded-lg bg-white shadow" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-neutral-500">Rendering…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
