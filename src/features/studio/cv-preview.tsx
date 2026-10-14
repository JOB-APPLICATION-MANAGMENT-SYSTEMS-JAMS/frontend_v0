"use client";

/**
 * A4 preview pane.
 *
 * The old preview dropped the document into a stretched iframe, so you were
 * looking at a fluid web page that happened to be a CV — never at the sheet that
 * prints. Here the document is rendered as a real 210×297mm sheet and scaled with
 * a transform, which is what makes zoom, the paper shadow and the page count
 * possible. The HTML is unchanged between preview and print, so the two cannot
 * drift apart.
 *
 * The sheet is measured from inside the iframe (same-origin `srcDoc`), so the
 * canvas can be exactly as tall as the content and page breaks can be marked.
 */
import * as React from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** A4 at 96dpi — the CSS pixel size of 210mm × 297mm. */
export const A4_W = 794;
export const A4_H = 1123;

export function CvPreview({
  html,
  busy,
  frameRef,
  actions,
  footer,
  className,
  onZoomChange,
}: {
  html: string;
  busy?: boolean;
  /** external ref so the page can trigger the browser's print pipeline */
  frameRef?: React.RefObject<HTMLIFrameElement | null>;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  onZoomChange?: (zoom: number) => void;
}) {
  const wellRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLIFrameElement | null>(null);
  const [fit, setFit] = React.useState(true);
  const [zoom, setZoom] = React.useState(1);
  const [wellW, setWellW] = React.useState(0);
  const [contentH, setContentH] = React.useState(A4_H);

  // track the well width so "fit" can resolve to a real scale
  React.useEffect(() => {
    const el = wellRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWellW(entry.contentRect.width));
    ro.observe(el);
    setWellW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const fitScale = wellW ? Math.max(0.2, Math.min(1.5, (wellW - 40) / A4_W)) : 0.6;
  const scale = fit ? fitScale : zoom;
  const pages = Math.max(1, Math.ceil((contentH - 4) / A4_H));

  React.useEffect(() => {
    onZoomChange?.(scale);
  }, [scale, onZoomChange]);

  // measure the sheet from inside the frame; again shortly after load, because the
  // first pass can land before the fallback font has settled the line wrapping
  const measure = React.useCallback(() => {
    const read = () => {
      const doc = innerRef.current?.contentDocument;
      if (!doc?.documentElement) return;
      // the sheet must never grow its own scrollbar — the well scrolls instead.
      // Deliberately not `overflow: hidden`: that can truncate Chromium's print
      // output to a single sheet, so only the scrollbars are hidden.
      if (!doc.getElementById("jams-sheet-css")) {
        const style = doc.createElement("style");
        style.id = "jams-sheet-css";
        style.textContent =
          "html,body{scrollbar-width:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}\n@media print{html,body{overflow:visible!important}}";
        doc.head?.appendChild(style);
      }
      setContentH(Math.max(A4_H, doc.documentElement.scrollHeight));
    };
    read();
    requestAnimationFrame(read);
    window.setTimeout(read, 350);
  }, []);

  const step = (dir: 1 | -1) => {
    const next = Math.min(1.6, Math.max(0.25, +((fit ? fitScale : zoom) + dir * 0.1).toFixed(2)));
    setFit(false);
    setZoom(next);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* toolbar: material-matched to the rest of the app */}
      <div className="glass-sheet flex flex-wrap items-center gap-2 rounded-xl px-2.5 py-2">
        <span className="eyebrow shrink-0">A4 preview</span>

        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums transition-colors",
            pages > 1 ? "border-ember/45 bg-ember/12 text-ember-deep dark:text-ember-soft" : "border-border text-muted-foreground"
          )}
          title={pages > 1 ? "This CV runs onto a second page" : "Fits on one page"}
        >
          {pages} {pages === 1 ? "page" : "pages"}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => step(-1)}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ember/10 hover:text-ember-deep dark:hover:text-ember-soft"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="tnum w-10 text-center text-[11px] font-semibold text-muted-foreground">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => step(1)}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ember/10 hover:text-ember-deep dark:hover:text-ember-soft"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Fit to width"
            title="Fit to width"
            onClick={() => setFit(true)}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-lg transition-colors",
              fit ? "bg-ember/14 text-ember-deep dark:text-ember-soft" : "text-muted-foreground hover:bg-ember/10"
            )}
          >
            <Maximize className="h-3.5 w-3.5" />
          </button>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>

      {/* the well: a recessed glass tray the sheet floats on */}
      <div
        ref={wellRef}
        data-busy={busy ? "true" : undefined}
        className="glass-track relative mt-2.5 min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl p-4 shadow-[inset_0_2px_8px_rgb(0_0_0/0.08)] sm:p-5 dark:shadow-[inset_0_2px_10px_rgb(0_0_0/0.6)]"
      >
        {/* a hairline, not a pulsing sheet: the preview re-renders as you type */}
        {busy && <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse rounded-full bg-[image:var(--gradient-brand)]" />}
        <div className="relative mx-auto" style={{ width: A4_W * scale, height: contentH * scale }}>
          <iframe
            ref={(node) => {
              innerRef.current = node;
              if (frameRef) frameRef.current = node;
            }}
            title="CV preview"
            srcDoc={html}
            onLoad={measure}
            tabIndex={-1}
            className="absolute left-0 top-0 origin-top-left rounded-[3px] border-0 bg-white shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35),0_1px_0_rgb(0_0_0/0.06)] dark:shadow-[0_16px_40px_-16px_rgb(0_0_0/0.9)]"
            style={{ width: A4_W, height: contentH, transform: `scale(${scale})` }}
          />
          {/* page boundaries, only when there is more than one sheet */}
          {pages > 1 &&
            Array.from({ length: pages - 1 }, (_, i) => (
              <div
                key={i}
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-ember/60"
                style={{ top: (i + 1) * A4_H * scale }}
              >
                <span className="absolute -top-2 left-1 rounded-full bg-ember px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary-foreground">
                  p{i + 2}
                </span>
              </div>
            ))}
          {!html && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Rendering…</div>}
        </div>
      </div>

      {footer && <div className="mt-2 shrink-0 text-[11px] leading-relaxed text-muted-foreground">{footer}</div>}
    </div>
  );
}
