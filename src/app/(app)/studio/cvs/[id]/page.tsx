"use client";

/** CV editor (§24.1): block editing, live A4 preview via the print-HTML route, ATS match panel. */
import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Download, Eye, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { CV, CVBlock } from "@/types";
import { Badge, Button, Card, Input, Label, ProgressBar, Select, Skeleton, Textarea } from "@/components/ui/base";
import { ErrorState, InlineBanner } from "@/components/ui/feedback";
import { Portal } from "@/components/ui/modal";
import { toast } from "@/hooks/use-toast";

const BLOCK_LABEL: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  projects: "Projects",
  education: "Education",
  awards: "Awards",
  custom: "Custom section",
};

export default function CVEditorPage() {
  return (
    <React.Suspense fallback={null}>
      <CVEditorPageInner />
    </React.Suspense>
  );
}

function CVEditorPageInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const [draft, setDraft] = React.useState<CV | null>(null);
  const [preview, setPreview] = React.useState<string>("");
  const [previewBusy, setPreviewBusy] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  // fullscreen A4 preview overlay, Esc closes it
  React.useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  const detail = useQuery<CV>({
    queryKey: qk.cv(id),
    queryFn: () => appFetch(`/cvs/${id}`, { _auth: true }),
  });

  React.useEffect(() => {
    if (detail.data && !draft) setDraft(structuredClone(detail.data));
  }, [detail.data, draft]);

  const match = useQuery<{
    ats: { score: number; checks: { key: string; label: string; ok: boolean; fix: string }[] };
    keywords: { matched: string[]; missing: string[]; coverage_pct: number | null; jd_total: number };
    jd_match: any;
    suggestions: string[];
  }>({
    queryKey: qk.cv(`${id}-match`),
    queryFn: () => appFetch(`/cvs/${id}/match`, { _auth: true }),
    enabled: !!detail.data,
  });

  const refreshPreview = React.useCallback(async () => {
    setPreviewBusy(true);
    try {
      const html = await appFetch<string>(`/cvs/${id}/html`, { _auth: true });
      setPreview(typeof html === "string" ? html : String(html));
    } catch (e: any) {
      toast("Preview failed to render", "error");
    } finally {
      setPreviewBusy(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (detail.data) void refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data]);

  const save = useMutation({
    mutationFn: () =>
      appFetch(`/cvs/${id}`, {
        method: "PUT",
        body: { name: draft!.name, archetype: draft!.archetype, career_category: draft!.career_category, blocks: draft!.blocks },
        _auth: true,
      }),
    meta: { invalidates: [["cvs"]] },
    onSuccess: () => {
      toast("Saved", "success");
      void refreshPreview();
    },
  });

  const duplicate = useMutation({
    mutationFn: () => appFetch<CV>(`/cvs/${id}/duplicate`, { method: "POST", _auth: true }),
    meta: { invalidates: [["cvs"]] },
    onSuccess: (cv) => router.push(`/studio/cvs/${cv.id}`),
  });

  const remove = useMutation({
    mutationFn: () => appFetch(`/cvs/${id}`, { method: "DELETE", _auth: true }),
    meta: { invalidates: [["cvs"]] },
    onSuccess: () => {
      toast("CV deleted", "info");
      router.push("/studio");
    },
  });

  // print pipeline (§24.1): Chromium's own print → Save as PDF, no paid renderer.
  // Must stay above the early returns below, hooks are unconditional (Rules of Hooks).
  React.useEffect(() => {
    if (search.get("print") === "1" && preview) {
      const t = setTimeout(() => iframeRef.current?.contentWindow?.print(), 400);
      return () => clearTimeout(t);
    }
  }, [preview, search]);

  if (detail.isPending || !draft) return <Skeleton className="h-[70vh] w-full" />;
  if (detail.error) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;

  const dirty = JSON.stringify({ n: draft.name, b: draft.blocks }) !== JSON.stringify({ n: detail.data!.name, b: detail.data!.blocks });

  const patchBlock = (i: number, patch: Partial<CVBlock>) =>
    setDraft({ ...draft, blocks: draft.blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });

  const addBlock = (type: CVBlock["type"]) =>
    setDraft({
      ...draft,
      blocks: [...draft.blocks, type === "skills" ? { type, groups: [] } : { type, title: BLOCK_LABEL[type], text: "" }],
    });

  // print pipeline (§24.1), hook lives above the early returns (see note next to its definition)
  const printCv = () => {
    if (!preview) return void refreshPreview();
    iframeRef.current?.contentWindow?.print();
  };

  return (
    <>
      <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[1fr_460px]">
      {/* left: editing + match */}
      <div className="space-y-5">
        <button onClick={() => router.push("/studio")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> CV Studio
        </button>

        <Card className="p-5">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <Label>CV name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label>Archetype</Label>
              <Select value={draft.archetype} onChange={(e) => setDraft({ ...draft, archetype: e.target.value as any })}>
                <option value="opening">Opening</option>
                <option value="pitch">Pitch</option>
              </Select>
            </div>
          </div>
          <div className="mt-3">
            <Label>Career category</Label>
            <Input value={draft.career_category ?? ""} onChange={(e) => setDraft({ ...draft, career_category: e.target.value })} placeholder="frontend, data…" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              <Check className="h-4 w-4" /> {save.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
            <Button variant="outline" onClick={() => setDraft(structuredClone(detail.data!))} disabled={!dirty}>
              <X className="h-4 w-4" /> Revert
            </Button>
            <Button variant="outline" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
              <Copy className="h-4 w-4" /> Fork
            </Button>
            <Button variant="outline" onClick={() => remove.mutate()} disabled={remove.isPending}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4" /> A4 preview
            </Button>
            <Button variant="azure" onClick={printCv}>
              <Download className="h-4 w-4" /> Print / PDF
            </Button>
          </div>
        </Card>

        {/* blocks */}
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Blocks</h2>
            <Select
              className="h-8 w-44 text-xs"
              value=""
              onChange={(e) => {
                if (e.target.value) addBlock(e.target.value as CVBlock["type"]);
              }}
            >
              <option value="">+ Add block…</option>
              <option value="summary">Summary</option>
              <option value="skills">Skills</option>
              <option value="projects">Projects</option>
              <option value="awards">Awards</option>
              <option value="custom">Custom section</option>
            </Select>
          </div>

          {draft.blocks.map((b, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{BLOCK_LABEL[b.type] ?? b.type}</span>
                  <Badge tone={b.source === "profile" ? "mint" : "neutral"}>{b.source === "profile" ? "from profile" : "local"}</Badge>
                </div>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setDraft({ ...draft, blocks: draft.blocks.filter((_, idx) => idx !== i) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {b.type === "skills" ? (
                <Textarea
                  value={(b.groups ?? []).join("\n")}
                  onChange={(e) => patchBlock(i, { groups: e.target.value.split("\n").filter(Boolean) })}
                  placeholder={"One skill group per line:\nTypeScript, React, Next.js\nNode.js, Express, SQLite"}
                  className="min-h-[70px]"
                />
              ) : b.type === "experience" || b.type === "education" || b.type === "projects" ? (
                <>
                  {b.title != null && (
                    <Input className="mb-2" value={b.title ?? ""} onChange={(e) => patchBlock(i, { title: e.target.value })} placeholder="Section title" />
                  )}
                  <Textarea
                    value={b.text ?? ""}
                    onChange={(e) => patchBlock(i, { text: e.target.value })}
                    placeholder="One bullet per line…"
                    className="min-h-[90px]"
                  />
                </>
              ) : (
                <>
                  <Input className="mb-2" value={b.title ?? BLOCK_LABEL[b.type]} onChange={(e) => patchBlock(i, { title: e.target.value })} />
                  <Textarea value={b.text ?? ""} onChange={(e) => patchBlock(i, { text: e.target.value })} placeholder="Write the section text…" />
                </>
              )}
            </div>
          ))}
        </Card>

        {/* match panel (§20.1) */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">ATS & keyword match</h2>
            <Button size="sm" variant="ghost" onClick={() => match.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Re-run
            </Button>
          </div>

          {match.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : match.error ? (
            <ErrorState error={match.error} onRetry={() => match.refetch()} />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <p className="font-display text-3xl font-extrabold">{match.data!.ats.score}%</p>
                <div className="flex-1">
                  <ProgressBar value={match.data!.ats.score} />
                  <p className="mt-1 text-[11px] text-muted-foreground">parse-ability checks passed</p>
                </div>
                {match.data!.keywords.coverage_pct != null && (
                  <div className="text-right">
                    <p className="font-display text-xl font-bold">{match.data!.keywords.coverage_pct}%</p>
                    <p className="text-[11px] text-muted-foreground">JD coverage</p>
                  </div>
                )}
              </div>

              <ul className="grid gap-1.5 sm:grid-cols-2">
                {match.data!.ats.checks.map((c) => (
                  <li key={c.key} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${c.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                    {c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {c.label}
                  </li>
                ))}
              </ul>

              {match.data!.keywords.missing.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Missing JD keywords (only add if true)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {match.data!.keywords.missing.map((k) => (
                      <Badge key={k} tone="rose">
                        {k}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {match.data!.suggestions.length > 0 && (
                <InlineBanner tone="info" title="Advisory suggestions">
                  <ul className="list-disc space-y-1 pl-4">
                    {match.data!.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </InlineBanner>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* right: A4 preview */}
      <div className="xl:sticky xl:top-20 xl:h-[calc(100vh-6rem)]">
        <Card className="flex h-full flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">A4 preview</h2>
            <Button size="sm" variant="outline" onClick={() => void refreshPreview()} disabled={previewBusy}>
              <RefreshCw className={`h-3.5 w-3.5 ${previewBusy ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-white">
            {preview ? (
              <iframe ref={iframeRef} title="CV preview" srcDoc={preview} className="h-full w-full" />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">Rendering…</div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Print/PDF uses the browser’s own pipeline, free, pixel-exact, no renderer service.
          </p>
        </Card>
      </div>
      </div>

      {/* fullscreen A4 preview, opened from the toolbar */}
      {previewOpen && (
        <Portal>
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="A4 preview"
        >
          <div className="flex h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/10 px-4 py-2.5">
              <span className="font-display text-sm font-bold text-neutral-900">A4 preview</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshPreview()}
                  disabled={previewBusy}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${previewBusy ? "animate-spin" : ""}`} /> Refresh
                </button>
                <button
                  type="button"
                  aria-label="Close preview"
                  onClick={() => setPreviewOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-neutral-200 p-3">
              {preview ? (
                <iframe title="Fullscreen A4 preview" srcDoc={preview} className="h-full w-full rounded-lg bg-white shadow" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-neutral-500">Rendering…</div>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
