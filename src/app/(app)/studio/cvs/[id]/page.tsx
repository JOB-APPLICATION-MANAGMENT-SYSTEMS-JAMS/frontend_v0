"use client";

/**
 * CV editor (§24.1) — two panes, the way FlowCV works: sections you open one at a
 * time on the left, the printed sheet on the right.
 *
 * The preview is the *same HTML the print pipeline sends*, served with `?frame=1`
 * so it arrives as a real A4 sheet. That means what you look at is what comes out
 * of the printer, at any zoom, with no second renderer to keep in sync.
 *
 * Saving is automatic (500ms after you stop typing, plus ⌘S), because losing a
 * tailored CV to a missed Save click is the worst possible failure here.
 */
import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Download, Eye, Printer, RefreshCw, Trash2, X } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { CV } from "@/types";
import { Badge, Button, Card, Input, Label, ProgressBar, Select, Skeleton } from "@/components/ui/base";
import { ConfirmDialog, ErrorState, InlineBanner } from "@/components/ui/feedback";
import { Portal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/menu";
import { Muted, Num } from "@/components/ui/text";
import { CvEditor } from "@/features/studio/cv-editor";
import { CvPreview } from "@/features/studio/cv-preview";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { toast } from "@/hooks/use-toast";

/** Ink is the document's own black and the default: the reference CV is
 * monochrome, so an accent is an opt-in, not something you have to undo. */
const ACCENTS = [
  { value: "ink", label: "Ink" },
  { value: "ember", label: "Ember" },
  { value: "graphite", label: "Graphite" },
] as const;

type Accent = (typeof ACCENTS)[number]["value"];

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
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);

  const [draft, setDraft] = React.useState<CV | null>(null);
  /**
   * `baseline` is the payload we last confirmed saved, not the server's copy.
   * Comparing against the refetch would make autosave loop forever the day the
   * backend starts normalising blocks on write; comparing against what we sent
   * cannot.
   */
  const [baseline, setBaseline] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [accent, setAccent] = React.useState<Accent>("ink");
  const [showMatch, setShowMatch] = React.useState(false);

  const detail = useQuery<CV>({
    queryKey: qk.cv(id),
    queryFn: () => appFetch(`/cvs/${id}`, { _auth: true }),
  });

  const [seeded, setSeeded] = React.useState(false);
  // seed the editable draft once the CV lands (adjust-during-render, not an effect)
  if (!seeded && detail.data) {
    setSeeded(true);
    setDraft(structuredClone(detail.data));
    setBaseline(serialise(detail.data));
  }

  const match = useQuery<{
    ats: {
      score: number;
      checks: {
        key: string;
        label: string;
        ok: boolean;
        severity: "critical" | "important" | "polish";
        /** what was actually looked at, and what it found */
        evidence: string;
        fix: string;
      }[];
      /** pages the sheet actually prints as */
      pages: number;
      band: "strong" | "decent" | "weak";
      blockers: number;
      summary: string;
    };
    keywords: { matched: string[]; missing: string[]; coverage_pct: number | null; jd_total: number };
    jd_match: unknown;
    suggestions: string[];
  }>({
    queryKey: qk.cv(`${id}-match`),
    queryFn: () => appFetch(`/cvs/${id}/match`, { _auth: true }),
    enabled: !!detail.data && showMatch,
  });

  const previewQuery = useQuery<string>({
    queryKey: qk.cv(`${id}-html-${accent}`),
    queryFn: () => appFetch<string>(`/cvs/${id}/html`, { params: { frame: 1, accent }, _auth: true }),
    enabled: !!detail.data,
  });
  const preview = previewQuery.data ?? "";
  const refreshPreview = React.useCallback(() => void previewQuery.refetch(), [previewQuery]);

  const save = useMutation({
    mutationFn: (body: CV) =>
      appFetch(`/cvs/${id}`, {
        method: "PUT",
        body: { name: body.name, archetype: body.archetype, career_category: body.career_category, blocks: body.blocks },
        _auth: true,
      }),
    // the detail is the saved state; the previews are re-rendered by the explicit
    // refresh below, which runs the moment the PUT resolves instead of after an
    // invalidation round-trip (that is what keeps the sheet feeling live)
    meta: { invalidates: [["cvs", "detail", id]], silentError: true },
    onSuccess: (_data, body) => {
      setBaseline(serialise(body));
      refreshPreview();
    },
    onError: () => toast("Autosave failed, your edits are still here, press Save", "error"),
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

  const dirty = !!draft && baseline !== null && serialise(draft) !== baseline;

  // autosave: half a second after the last keystroke, and again if the server copy
  // moved underneath us. `save.mutate` is stable across renders in React Query.
  React.useEffect(() => {
    if (!dirty || !draft || save.isPending) return;
    const t = setTimeout(() => save.mutate(draft), 500);
    return () => clearTimeout(t);
  }, [dirty, draft, save.isPending, save.mutate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⌘S / Ctrl+S saves immediately instead of scheduling
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && draft && !save.isPending) save.mutate(draft);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, draft, save]);

  // the page behind the fullscreen sheet must not scroll under it — and because
  // the gutter is reserved in CSS, locking cannot reflow the sheet's well
  useScrollLock(previewOpen);

  /* Below xl the sheet pane is hidden by CSS, but a `display: none` iframe still
     loads and lays out its document — i.e. the whole CV rendered a second time for
     nothing, on the devices least able to afford it. The pane is mounted for the
     breakpoint instead, and only one sheet exists at any moment. */
  const wideEnoughForPane = useMediaQuery("(min-width: 1280px)");

  // Esc closes the fullscreen sheet
  React.useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  // print pipeline (§24.1): Chromium's own print → Save as PDF, no paid renderer.
  const printCv = React.useCallback(() => {
    const win = frameRef.current?.contentWindow;
    if (!win || !preview) return void refreshPreview();
    win.focus();
    win.print();
  }, [preview, refreshPreview]);

  // ?print=1 deep link from the studio list
  React.useEffect(() => {
    if (search.get("print") === "1" && preview) {
      const t = setTimeout(() => frameRef.current?.contentWindow?.print(), 500);
      return () => clearTimeout(t);
    }
  }, [preview, search]);

  if (detail.isPending || !draft) return <Skeleton className="h-[70vh] w-full" />;
  if (detail.error) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;

  const status = save.isPending ? "saving" : dirty ? "dirty" : "saved";

  const previewFooter = (
    <span>
      Prints through the browser&rsquo;s own PDF pipeline, free and pixel-exact. The sheet above is that exact page.
    </span>
  );

  const previewActions = (
    <>
      <Button size="sm" variant="ghost" onClick={refreshPreview} disabled={previewQuery.isFetching} title="Re-render">
        <RefreshCw className={`h-3.5 w-3.5 ${previewQuery.isFetching ? "animate-spin" : ""}`} />
      </Button>
      <Button size="sm" variant="azure" onClick={printCv} className="hidden sm:inline-flex">
        <Printer className="h-3.5 w-3.5" /> PDF
      </Button>
    </>
  );

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]">
        <div className="min-w-0 space-y-4">
          {/* header: identity + the one irreversible action */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/studio")}
              className="press inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Studio
            </button>

            <SaveState status={status} onSave={() => dirty && save.mutate(draft)} />

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)} className="xl:hidden">
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
              <Button size="sm" variant="outline" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
                <Copy className="h-3.5 w-3.5" /> Fork
              </Button>
              <Button size="sm" variant="azure" onClick={printCv} className="xl:hidden">
                <Printer className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)} disabled={remove.isPending} title="Delete this CV">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* document identity */}
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr_1fr]">
              <div className="min-w-0">
                <Label htmlFor="cv-name">CV name</Label>
                <Input id="cv-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="min-w-0">
                <Label htmlFor="cv-arch">Archetype</Label>
                <Select id="cv-arch" value={draft.archetype} onChange={(e) => setDraft({ ...draft, archetype: e.target.value as CV["archetype"] })}>
                  <option value="opening">Opening (broad, ATS-safe)</option>
                  <option value="pitch">Pitch (tailored, dense)</option>
                </Select>
              </div>
              <div className="min-w-0">
                <Label htmlFor="cv-cat">Career category</Label>
                <Input
                  id="cv-cat"
                  value={draft.career_category ?? ""}
                  onChange={(e) => setDraft({ ...draft, career_category: e.target.value })}
                  placeholder="frontend, data…"
                />
              </div>
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
              The page header, contact row and profile sections come from your{" "}
              <button onClick={() => router.push("/profile")} className="font-semibold text-accent hover:underline">
                Profile
              </button>
              . Sections marked <span className="font-semibold text-foreground">profile</span> stay in sync with it; the rest belong to this CV only.
            </p>
          </Card>

          {/* the editor */}
          <CvEditor draft={draft} onChange={setDraft} />

          {/* match panel (§20.1), collapsed until asked for */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="eyebrow">ATS &amp; keyword match</h2>
              <div className="flex items-center gap-2">
                {match.data && (
                  <Badge tone={match.data.ats.band === "strong" ? "mint" : "rose"}>
                    {match.data.ats.score}% ATS · {match.data.ats.pages}p
                  </Badge>
                )}
                <Button size="sm" variant="ghost" onClick={() => setShowMatch((v) => !v)}>
                  {showMatch ? "Hide" : "Check this CV"}
                </Button>
              </div>
            </div>

            {showMatch && (
              <div className="mt-3">
                {match.isPending ? (
                  <Skeleton className="h-24 w-full" />
                ) : match.error ? (
                  <ErrorState error={match.error} onRetry={() => match.refetch()} />
                ) : match.data ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <p className="hero-num text-3xl">
                        <Num>{match.data.ats.score}%</Num>
                      </p>
                      <div className="min-w-0 flex-1">
                        <ProgressBar value={match.data.ats.score} />
                        <Muted className="mt-1">
                          {match.data.ats.summary} Prints as <Num>{match.data.ats.pages}</Num> page
                          {match.data.ats.pages === 1 ? "" : "s"}.
                        </Muted>
                      </div>
                      {match.data.keywords.coverage_pct != null && (
                        <div className="shrink-0 text-right">
                          <p className="hero-num text-xl">
                            <Num>{match.data.keywords.coverage_pct}%</Num>
                          </p>
                          <Muted>JD coverage</Muted>
                        </div>
                      )}
                    </div>

                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {match.data.ats.checks.map((c) => (
                        <li
                          key={c.key}
                          className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                            c.ok
                              ? "bg-ember/12 text-ember-deep dark:text-ember-soft"
                              : c.severity === "critical"
                                ? "bg-ink/8 text-destructive"
                                : c.severity === "important"
                                  ? "bg-ink/8 text-foreground"
                                  : "bg-ink/5 text-muted-foreground"
                          }`}
                          title={c.ok ? undefined : c.fix}
                        >
                          <span className="mt-0.5 shrink-0">
                            {c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block leading-snug">{c.label}</span>
                            <span className="block text-[10px] leading-snug opacity-70">{c.evidence}</span>
                            {!c.ok && c.severity !== "polish" && (
                              <span className="mt-0.5 block text-[10px] leading-snug opacity-80">{c.fix}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {match.data.keywords.missing.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Missing JD keywords (only add if true)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {match.data.keywords.missing.map((k) => (
                            <Badge key={k} tone="rose">
                              {k}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {match.data.suggestions.length > 0 && (
                      <InlineBanner tone="info" title="Advisory suggestions">
                        <ul className="list-disc space-y-1 pl-4">
                          {match.data.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </InlineBanner>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </Card>
        </div>

        {/* right: the sheet — sticky on large screens only, a modal below xl.
            Unmounted while the fullscreen sheet is open: one document, one
            measurement pass, so opening it cannot disturb the pane behind. */}
        <div className="hidden xl:sticky xl:top-20 xl:block xl:h-[calc(100vh-6rem)]">
          {wideEnoughForPane && !previewOpen && (
            <CvPreview html={preview} busy={previewQuery.isFetching} frameRef={frameRef} actions={previewActions} footer={previewFooter} className="h-full" />
          )}
        </div>
      </div>

      {/* accent + a persistent action bar only on phones, where the sheet is hidden */}
      <div className="glass-sheet mt-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5 xl:hidden">
        <span className="eyebrow px-1">Accent</span>
        <SegmentedControl ariaLabel="CV accent" size="sm" value={accent} onChange={setAccent} options={ACCENTS.map((a) => ({ value: a.value, label: a.label }))} />
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-3.5 w-3.5" /> Open A4
        </Button>
      </div>

      {/* desktop accent switch, next to the sheet it controls */}
      <div className="mt-3 hidden items-center gap-2 xl:flex">
        <span className="eyebrow">Document accent</span>
        <SegmentedControl ariaLabel="CV accent" size="sm" value={accent} onChange={setAccent} options={ACCENTS.map((a) => ({ value: a.value, label: a.label }))} />
        <span className="text-[11px] text-muted-foreground">rules and skill markers only; the text stays paper black</span>
      </div>

      {/* destructive action behind a confirm, the shape the rest of the app uses */}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this CV?"
        description={`“${draft.name}” and its tailoring are removed for good. Applications already sent keep their record.`}
        confirmLabel={remove.isPending ? "Deleting…" : "Delete CV"}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />

      {/* fullscreen sheet: the phone/tablet preview */}
      {previewOpen && (
        <Portal>
          <div
            className="scrim-in fixed inset-0 z-[120] flex flex-col bg-black/75 p-2 backdrop-blur-md sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="A4 preview"
            onClick={() => setPreviewOpen(false)}
          >
            <div
              className="glass-panel sheet-in flex min-h-0 flex-1 flex-col rounded-2xl p-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              <CvPreview
                html={preview}
                busy={previewQuery.isFetching}
                frameRef={frameRef}
                actions={
                  <>
                    <Button size="sm" variant="ghost" onClick={refreshPreview} disabled={previewQuery.isFetching} title="Re-render">
                      <RefreshCw className={`h-3.5 w-3.5 ${previewQuery.isFetching ? "animate-spin" : ""}`} />
                    </Button>
                    <Button size="sm" variant="azure" onClick={printCv}>
                      <Printer className="h-3.5 w-3.5" /> Print / PDF
                    </Button>
                  </>
                }
                footer={previewFooter}
                className="min-h-0 flex-1"
              />
              <div className="mt-2 flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-1 pt-2">
                <SegmentedControl ariaLabel="CV accent" size="sm" value={accent} onChange={setAccent} options={ACCENTS.map((a) => ({ value: a.value, label: a.label }))} />
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => setPreviewOpen(false)}>
                  <X className="h-3.5 w-3.5" /> Close
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

/** The fields that make a CV a CV. `lineage` and `targeting` are preserved as-is. */
function serialise(cv: CV) {
  return JSON.stringify({ n: cv.name, a: cv.archetype, c: cv.career_category, b: cv.blocks });
}

/** Save state + a manual escape hatch. Autosave is the default, this is the proof. */
function SaveState({ status, onSave }: { status: "saving" | "dirty" | "saved"; onSave: () => void }) {
  const tone =
    status === "saving"
      ? "border-border text-muted-foreground"
      : status === "dirty"
        ? "border-ember/50 bg-ember/12 text-ember-deep dark:text-ember-soft"
        : "border-border text-muted-foreground";
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={status === "saved"}
      title={status === "saved" ? "Everything is saved" : "Save now (⌘S)"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${tone} ${status === "saved" ? "cursor-default" : "cursor-pointer hover:border-ember/60"}`}
    >
      {status === "saving" ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" /> Saving…
        </>
      ) : status === "dirty" ? (
        <>
          <Download className="h-3 w-3" /> Save (⌘S)
        </>
      ) : (
        <>
          <Check className="h-3 w-3" /> Saved
        </>
      )}
    </button>
  );
}
