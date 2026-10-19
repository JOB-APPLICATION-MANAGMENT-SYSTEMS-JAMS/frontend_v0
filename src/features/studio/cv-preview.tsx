"use client";

/**
 * A4 preview pane.
 *
 * The old preview dropped the document into a stretched iframe, so you were
 * looking at a fluid web page that happened to be a CV - never at the sheet that
 * prints. Here the document is a real 210×297mm sheet, scaled with a transform,
 * which is what makes zoom, the paper shadow and the page markers possible. The
 * HTML is identical between preview and print, so the two cannot drift.
 *
 * Three rules keep it from twitching, and each one exists because of a specific
 * way a preview like this flickers:
 *
 * 1. Nothing is measured that the preview itself can change. The well hides its
 *    own scrollbars (`no-scrollbar`) and the frame hides its document's, so the
 *    width "fit" depends on never moves because of the sheet inside it. A
 *    scrollbar taking 15px off the well used to shrink the sheet, which removed
 *    the scrollbar, which grew it again - the loop that made the zoom look like
 *    it was breathing.
 * 2. Every measurement is quantised and only replaces the previous one when it
 *    really moved. Fit resolves to 0.5% steps so a 1px layout wobble cannot
 *    change it, and the sheet height is committed only once two reads 120ms
 *    apart agree, so a webfont settling cannot bounce the page count.
 * 3. The sheet is scaled from a width that was measured before the first paint
 *    (`useLayoutEffect`), and it stays invisible until then. There is no guessed
 *    scale to snap away from, which is what the open-then-jump flash was.
 */
import * as React from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** A4 at 96dpi - the CSS pixel size of 210mm × 297mm. */
export const A4_W = 794;
export const A4_H = 1123;

const MIN_SCALE = 0.25;
const MAX_SCALE = 1.6;

/** Fit resolves to 0.5% steps: fine enough to fill the well, coarse enough that
 *  sub-pixel layout noise cannot change it. */
const quantise = (n: number) => Math.round(n * 200) / 200;

/** Two reads this far apart must agree before a sheet height is believed. */
const SETTLE_MS = 120;
const SETTLE_TRIES = 10;

/** The well's content box - padding excluded, because the sheet fills the box. */
function contentWidth(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  return el.clientWidth - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0");
}

export function CvPreview({
  html,
  busy,
  frameRef,
  actions,
  footer,
  className,
}: {
  html: string;
  busy?: boolean;
  /** external ref so the page can trigger the browser's print pipeline */
  frameRef?: React.RefObject<HTMLIFrameElement | null>;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const wellRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLIFrameElement | null>(null);
  const [fit, setFit] = React.useState(true);
  const [manual, setManual] = React.useState(1);
  const [fitScale, setFitScale] = React.useState(0);
  const [sheetH, setSheetH] = React.useState(A4_H);

  // Width: the only input to "fit". Whatever this observer reports is what the
  // first paint measured - same box, same units, whole pixels.
  React.useLayoutEffect(() => {
    const el = wellRef.current;
    if (!el) return;
    let accepted = -1;
    const read = () => {
      const w = Math.round(contentWidth(el));
      // 1px is 0.13% of the sheet: below the quantisation step, so ignoring it
      // cannot change the scale. Reacting to it is what causes the flicker.
      if (Math.abs(w - accepted) < 2 && accepted > 0) return;
      accepted = w;
      // 2px of breathing room: the tray has an inner shadow and the sheet a
      // drop shadow, and a sheet flush to both edges reads as clipped.
      setFitScale(quantise(Math.max(MIN_SCALE, Math.min(MAX_SCALE, (w - 2) / A4_W))));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Height: the sheet is taller than one page once the content runs on, and the
  // page markers are placed from this. Read until two consecutive reads agree so
  // a late webfont swap cannot commit an intermediate height.
  const settle = React.useCallback(() => {
    let tries = 0;
    let previous = -1;
    const read = () => {
      const doc = innerRef.current?.contentDocument;
      if (doc?.documentElement) {
        // The sheet must never grow its own scrollbar. Deliberately not
        // `overflow: hidden`: that can truncate Chromium's print output to one
        // sheet, so only the scrollbars are hidden.
        if (!doc.getElementById("jams-sheet-css")) {
          const style = doc.createElement("style");
          style.id = "jams-sheet-css";
          style.textContent =
            "html,body{scrollbar-width:none;scrollbar-gutter:auto}" +
            "html::-webkit-scrollbar,body::-webkit-scrollbar{display:none;width:0;height:0}" +
            "@media print{html,body{overflow:visible!important}}";
          doc.head?.appendChild(style);
        }
        const h = Math.max(A4_H, Math.round(doc.documentElement.scrollHeight));
        if (h === previous) {
          setSheetH((prev) => (prev === h ? prev : h));
          return;
        }
        previous = h;
      }
      if (tries++ < SETTLE_TRIES) window.setTimeout(read, SETTLE_MS);
    };
    read();
  }, []);

  React.useEffect(() => {
    settle();
  }, [html, settle]);

  const measured = fitScale > 0;
  const scale = fit ? (measured ? fitScale : 1) : manual;
  const pages = Math.max(1, Math.ceil((sheetH - 4) / A4_H));

  const setZoom = (dir: 1 | -1) => {
    const base = fit ? (measured ? fitScale : 1) : manual;
    setManual(quantise(Math.min(MAX_SCALE, Math.max(MIN_SCALE, base + dir * 0.1))));
    setFit(false);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* toolbar */}
      <div className="glass-sheet flex flex-wrap items-center gap-2 rounded-xl px-2.5 py-2">
        {/* dropped below `sm`, where the toolbar has to fit the page count, the
            zoom controls and the actions on one line */}
        <span className="eyebrow hidden shrink-0 sm:inline">A4 preview</span>

        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums transition-colors",
            pages > 1 ? "border-ember/45 bg-ember/12 text-ember-deep dark:text-ember-soft" : "border-border text-muted-foreground"
          )}
          title={pages > 1 ? `This CV runs onto ${pages} pages` : "Fits on one page"}
        >
          {pages} {pages === 1 ? "page" : "pages"}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom(-1)}
            className="touch-slop grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ember/10 hover:text-ember-deep dark:hover:text-ember-soft"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="tnum w-10 text-center text-[11px] font-semibold text-muted-foreground">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom(1)}
            className="touch-slop grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ember/10 hover:text-ember-deep dark:hover:text-ember-soft"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Fit to width"
            title="Fit to width"
            onClick={() => setFit(true)}
            className={cn(
              "touch-slop grid h-7 w-7 place-items-center rounded-lg transition-colors",
              fit ? "bg-ember/14 text-ember-deep dark:text-ember-soft" : "text-muted-foreground hover:bg-ember/10"
            )}
          >
            <Maximize className="h-3.5 w-3.5" />
          </button>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>

      {/* the well: a recessed tray the sheet floats on. It scrolls by wheel,
          touch and keyboard, and shows no scrollbar anywhere - a scrollbar here
          would change the width that "fit" is computed from. */}
      <div
        ref={wellRef}
        data-busy={busy ? "true" : undefined}
        role="region"
        aria-label="CV sheet"
        tabIndex={0}
        onDoubleClick={() => setFit(true)}
        className={cn(
          "no-scrollbar glass-track relative mt-2.5 min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl p-4 outline-none",
          "shadow-[inset_0_2px_8px_rgb(0_0_0/0.08)] focus-visible:ring-2 focus-visible:ring-ember/40 dark:shadow-[inset_0_2px_10px_rgb(0_0_0/0.6)]"
        )}
      >
        {/* a hairline, not a pulsing sheet: the re-render is a fraction of a second */}
        {busy && <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse rounded-full bg-[image:var(--gradient-brand)]" />}
        <div
          className="relative mx-auto transition-opacity duration-150"
          style={{ width: A4_W * scale, height: sheetH * scale, opacity: measured ? 1 : 0 }}
        >
          <iframe
            ref={(node) => {
              innerRef.current = node;
              if (frameRef) frameRef.current = node;
            }}
            title="CV preview"
            srcDoc={html}
            onLoad={settle}
            tabIndex={-1}
            className="absolute left-0 top-0 origin-top-left rounded-[3px] border-0 bg-white shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35),0_1px_0_rgb(0_0_0/0.06)] dark:shadow-[0_16px_40px_-16px_rgb(0_0_0/0.9)]"
            style={{ width: A4_W, height: sheetH, transform: `scale(${scale})` }}
          />
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
