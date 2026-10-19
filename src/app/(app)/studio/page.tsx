"use client";

/** Resume Studio (§24): versioned resumes per archetype, forking, template library, print pipeline. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Copy, Eye, FilePlus2, FileText, Printer, RefreshCw, Trash2, X } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { CV, Template } from "@/types";
import { Badge, Button, Card, Input, Label, Select, Skeleton } from "@/components/ui/base";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { CvShelf } from "@/features/studio/cv-shelf";
import { Portal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/layout";
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
    // the shelf's folder menus create straight into their own archetype, so the
    // archetype is an argument here rather than something the caller has to set first
    mutationFn: (into?: "opening" | "pitch") => {
      const arch = into ?? archetype;
      return appFetch<CV>("/cvs", {
        method: "POST",
        body: {
          name: name.trim() || `${arch === "opening" ? "Opening" : "Pitch"} CV`,
          archetype: arch,
          career_category: category.trim() || undefined,
          // profile-sourced blocks stay in sync with the Profile page (§24.1).
          // The summary is local on purpose: a profile has no summary field, so
          // marking it "profile" was a promise the document could not keep - it
          // printed nothing and still showed a PROFILE badge in the editor.
          blocks: [
            { type: "summary", source: "local" },
            { type: "experience", source: "profile" },
            { type: "skills", source: "profile" },
            { type: "education", source: "profile" },
          ],
        },
        _auth: true,
      });
    },
    meta: { invalidates: [["cvs"]] },
    onSuccess: (cv) => {
      toast("Resume created, tailor it in the editor", "success");
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

  // fullscreen A4 preview, openable straight from a CV card
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
      <PageHeader
        eyebrow="Documents"
        title="Resume Studio"
        description="One resume per archetype, forked per application, reviewed by people you trust. Your master resume is never mutated."
      />

      {/* create */}
      <Card className="p-5">
        <h2 className="eyebrow mb-3">New resume</h2>
        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-end">
          <div>
            <Label>Resume name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Frontend, Series A SaaS" />
          </div>
          <div>
            <Label>Archetype</Label>
            <Select value={archetype} onChange={(e) => setArchetype(e.target.value as "opening" | "pitch")}>
              <option value="opening">Opening (broad, ATS-safe)</option>
              <option value="pitch">Pitch (tailored, dense)</option>
            </Select>
          </div>
          <div>
            <Label>Career category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="frontend, data, pm…" />
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <FilePlus2 className="h-4 w-4" /> Create resume
          </Button>
        </div>
      </Card>

      {/* the shelf: the same CVs as objects you can open, one folder per archetype */}
      {cvs.data?.items?.length ? (
        <CvShelf
          cvs={cvs.data.items}
          templates={templates.data?.items ?? []}
          onCreate={(into) => create.mutate(into)}
          onFork={(id) => duplicate.mutate(id)}
        />
      ) : null}

      {/* CV grid: every per-CV action, shelf sheets only open the editor */}
      {(cvs.data?.items?.length ?? 0) > 0 ? <h2 className="eyebrow">All resumes</h2> : null}
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
          title="No resumes yet"
          description="Create your first one. Profile blocks stay linked to the Profile page; local blocks are yours to tailor."
          action={<Button onClick={() => create.mutate()}>Create from profile</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cvs.data!.items.map((cv, i) => (
            <Card key={cv.id} className="animate-stagger flex flex-col p-4" style={{ "--i": i } as React.CSSProperties}>
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
                {/* icon-only actions: touch-slop keeps the 32px look on a cursor
                    and a 44px target under a thumb */}
                <Button size="sm" variant="outline" className="touch-slop" aria-label={`A4 preview of ${cv.name}`} title="A4 preview" onClick={() => openPreview(cv.id)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="touch-slop" aria-label={`Open print view of ${cv.name}`} title="Open print view (Save as PDF)" onClick={() => router.push(`/studio/cvs/${cv.id}?print=1`)}>
                  <Printer className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="touch-slop" aria-label={`Fork ${cv.name}`} title="Fork this CV" onClick={() => duplicate.mutate(cv.id)} disabled={duplicate.isPending}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="touch-slop" aria-label={`Delete ${cv.name}`} title="Delete" onClick={() => remove.mutate(cv.id)} disabled={remove.isPending}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* template library */}
      <Card className="p-5">
        <h2 className="eyebrow mb-3">Resume templates</h2>
        {templates.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : (templates.data?.items?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No templates yet, seed one from Settings → Export or write your own in Outreach.</p>
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

      {/* fullscreen A4 preview, opened from a CV card */}
      {previewId && (
        <Portal>
        <div
          className="scrim-in fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="A4 preview"
        >
          <div className="glass-panel sheet-in flex h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <span className="truncate font-display text-sm font-bold text-foreground">
                A4 preview{cvs.data?.items.find((c) => c.id === previewId)?.name ? `, ${cvs.data!.items.find((c) => c.id === previewId)!.name}` : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadPreview(previewId)}
                  disabled={previewBusy}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-ember/45 hover:bg-ember/10 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${previewBusy ? "animate-spin" : ""}`} /> Refresh
                </button>
                <button
                  type="button"
                  aria-label="Close preview"
                  onClick={() => setPreviewId(null)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-muted p-3">
              {previewHtml ? (
                <iframe title="A4 preview" srcDoc={previewHtml} className="h-full w-full rounded-lg bg-white shadow" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">Rendering…</div>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
