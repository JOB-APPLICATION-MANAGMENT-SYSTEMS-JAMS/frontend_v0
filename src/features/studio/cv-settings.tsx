"use client";

/**
 * Document settings - the panel behind the sheet.
 *
 * A CV is not one fixed sheet: the same words are set differently for a one-page
 * ATS read than for a two-page executive one. This panel is the whole of that
 * choice, and it is deliberately *the same list of settings the renderer reads*
 * (`CvDesign` on the CV, resolved by `resolveMetrics` in the backend document).
 * Nothing here is decorative: every control changes the printed page, and the
 * page count the ATS panel reports is computed from these values, so a setting
 * that moves the geometry moves the count with it.
 *
 * Two idioms, and only two: a segmented control for a set, a stepper for a
 * number. Both are the ones the editor already uses, so the panel reads as part
 * of the document rather than as a settings screen bolted on.
 */
import * as React from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button, Card, Label, SegmentedControl, Switch } from "@/components/ui/base";
import { cn } from "@/lib/utils";
import type { CvDesign } from "@/types";

/** Steps are coarse enough to feel like paper, fine enough to land on a value. */
type StepperProps = {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min: number;
  max: number;
  suffix?: string;
  /** Values are shown with one decimal, like a word processor's font field. */
  decimals?: number;
};

function Stepper({ label, hint, value, onChange, step = 1, min, max, suffix = "", decimals = 0 }: StepperProps) {
  const snap = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step));
  const at = (d: 1 | -1) => onChange(snap(value + d * step));
  const shown = value.toFixed(decimals);
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <Label className="block">{label}</Label>
        {hint ? <span className="block text-[11px] leading-tight text-muted-foreground">{hint}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`${label}: decrease`}
          onClick={() => at(-1)}
          disabled={value <= min}
          className="touch-slop grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ember/10 hover:text-ember-deep disabled:opacity-35 disabled:hover:bg-transparent dark:hover:text-ember-soft"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="tnum w-[3.9rem] text-center text-xs font-semibold" aria-live="polite">
          {shown}
          {suffix}
        </span>
        <button
          type="button"
          aria-label={`${label}: increase`}
          onClick={() => at(1)}
          disabled={value >= max}
          className="touch-slop grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ember/10 hover:text-ember-deep disabled:opacity-35 disabled:hover:bg-transparent dark:hover:text-ember-soft"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-1.5">
      <span className="min-w-0">
        <Label className="block">{label}</Label>
        {hint ? <span className="block text-[11px] leading-tight text-muted-foreground">{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border/60 pt-2 first:border-0 first:pt-0">
      <h3 className="eyebrow mb-0.5">{title}</h3>
      <div className="divide-y divide-border/40">{children}</div>
    </section>
  );
}

const ACCENTS = [
  { value: "ink", label: "Ink" },
  { value: "ember", label: "Ember" },
  { value: "graphite", label: "Graphite" },
];

/** The defaults, so the panel can say what "reset" means and show a dirty dot. */
const DEFAULTS: Required<Pick<CvDesign, "page" | "font" | "base" | "lineHeight" | "marginX" | "marginY" | "sectionGap" | "entryGap" | "skillCols" | "caps" | "dates" | "datePos" | "align" | "icons" | "headIcons" | "accent" | "rule" | "headTone">> = {
  page: "a4",
  font: "serif",
  base: 10.5,
  lineHeight: 1.29,
  marginX: 20,
  marginY: 15,
  sectionGap: 19,
  entryGap: 12,
  skillCols: 3,
  caps: "none",
  dates: "keep",
  datePos: "left",
  align: "center",
  icons: "none",
  headIcons: "none",
  accent: "ink",
  rule: true,
  headTone: "accent",
};

/**
 * The presets speak only to these keys. "Is this preset already applied?" is a
 * question about the whole sheet, so it is asked over exactly the settings a
 * preset writes - every one of them against its measured default, since a design
 * that says `{ font: "sans" }` and one that says nothing but `sans` everywhere
 * else are the same sheet.
 */
const PRESET_KEYS = [
  "page",
  "font",
  "accent",
  "base",
  "lineHeight",
  "marginX",
  "marginY",
  "sectionGap",
  "entryGap",
  "skillCols",
  "caps",
  "align",
  "rule",
  "headTone",
  "datePos",
  "icons",
  "headIcons",
  "dates",
] as const satisfies readonly (keyof CvDesign)[];

/** Swatch colours must be the printed ones, not a guess: these mirror `CV_ACCENTS`. */
const ACCENT_HEX: Record<string, string> = { ink: "#000000", ember: "#b35f00", graphite: "#5b564f" };

type Preset = { name: string; note: string; design: CvDesign };

/**
 * Whole-sheet presets - the "update the entire design with one click" idea from
 * the reference editor, without the remote gallery: a preset is nothing but a
 * `CvDesign`, and applying one replaces the current design with it, so what the
 * tile shows is exactly what the renderer reads. No fetch, no template ids to
 * resolve, and every value is one the panel below can still be nudged from.
 */
const PRESETS: Preset[] = [
  {
    name: "Classic",
    note: "The reference sheet",
    design: { ...DEFAULTS },
  },
  {
    name: "Steady",
    note: "Even, scannable",
    design: {
      page: "a4",
      font: "sans",
      accent: "graphite",
      base: 10,
      lineHeight: 1.34,
      marginX: 18,
      marginY: 14,
      sectionGap: 18,
      entryGap: 11,
      skillCols: 2,
      caps: "upper",
      align: "center",
      rule: true,
      headTone: "accent",
      datePos: "left",
      icons: "circle",
      headIcons: "outline",
      dates: "month",
    },
  },
  {
    name: "ATS plain",
    note: "Parser-friendly",
    design: {
      page: "a4",
      font: "sans",
      accent: "ink",
      base: 10,
      lineHeight: 1.24,
      marginX: 16,
      marginY: 14,
      sectionGap: 15,
      entryGap: 9,
      skillCols: 3,
      caps: "upper",
      align: "left",
      rule: false,
      headTone: "ink",
      datePos: "left",
      icons: "none",
      headIcons: "none",
      dates: "dots",
    },
  },
  {
    name: "Ember",
    note: "Brand accent, bolder",
    design: {
      page: "a4",
      font: "serif",
      accent: "ember",
      base: 11,
      lineHeight: 1.32,
      marginX: 18,
      marginY: 15,
      sectionGap: 20,
      entryGap: 12,
      skillCols: 3,
      caps: "upper",
      align: "left",
      rule: true,
      headTone: "accent",
      datePos: "left",
      icons: "square-fill",
      headIcons: "filled",
      dates: "month",
    },
  },
  {
    name: "Compact",
    note: "Dense, long careers",
    design: {
      page: "a4",
      font: "serif",
      accent: "ink",
      base: 9.5,
      lineHeight: 1.18,
      marginX: 14,
      marginY: 12,
      sectionGap: 12,
      entryGap: 8,
      skillCols: 4,
      caps: "capitalize",
      align: "center",
      rule: true,
      headTone: "accent",
      datePos: "left",
      icons: "none",
      headIcons: "none",
      dates: "keep",
    },
  },
  {
    name: "US letter",
    note: "216 × 279mm, US",
    design: { ...DEFAULTS, page: "letter", base: 11, marginX: 22, marginY: 16, skillCols: 2 },
  },
];

/** The preset's own values, read through the defaults - see `PRESET_KEYS`. */
const signature = (d: CvDesign) => JSON.stringify(PRESET_KEYS.map((k) => d[k] ?? DEFAULTS[k]));

export function CvSettings({
  design,
  onChange,
  className,
}: {
  design: CvDesign;
  /** Receives a whole design; the page merges it into the draft and autosaves. */
  onChange: (next: CvDesign) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const d = design ?? {};
  const set = <K extends keyof CvDesign>(key: K, value: CvDesign[K]) => onChange({ ...d, [key]: value });

  const links = d.links ?? {};
  const changed = Object.keys(d).length > 0;
  const current = signature(d);

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow">Document settings</h2>
        <div className="flex items-center gap-2">
          {changed && (
            <button
              type="button"
              onClick={() => onChange({})}
              className="press inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          <Button size="sm" variant={open ? "ghost" : "outline"} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "Done" : "Open settings"}
          </Button>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        {open
          ? "Every control here changes the printed sheet and the page count beside it."
          : "Page size, type, spacing, headings and colour for this CV alone - the sheet updates as you change it."}
      </p>

      {/* presets stay visible when the panel is closed - the point of one click is
          that it never needed the panel in the first place */}
      <div className="mt-3">
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="eyebrow mb-0">Design templates</h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            one click · whole sheet
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = signature(p.design) === current;
            const hex = ACCENT_HEX[String(p.design.accent)] ?? ACCENT_HEX.ink;
            const left = p.design.align === "left";
            const line = p.design.lineHeight ?? 1.29;
            // density reads off the swatch: a tight leading simply draws more lines
            const rows = line < 1.2 ? 5 : line < 1.3 ? 4 : 3;
            const gap = line < 1.2 ? 2 : 3;
            const bar = (w: string, h: number, color: string, opacity = 1) => (
              <span
                className="block rounded-[1px]"
                style={{ width: w, height: h, background: color, opacity, marginInline: left ? 0 : "auto" }}
              />
            );
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => onChange({ ...p.design })}
                aria-pressed={active}
                title={`${p.name} - ${p.note}`}
                className={cn(
                  // 150px tiles two-up from 390 down; on a 320 phone the card's
                  // inner width is 256px, so they split it instead of stacking five
                  // full-width rows between the top of the page and the editor
                  "press group w-[150px] max-sm:w-[calc(50%-0.25rem)] shrink-0 rounded-xl border p-2 text-left transition-colors duration-200",
                  active
                    ? "border-foreground/25 bg-foreground/[0.05] shadow-[inset_0_1px_0_var(--glass-lip)]"
                    : "border-border/60 hover:border-foreground/20 hover:bg-muted/60"
                )}
              >
                {/* the swatch is the preset drawn small: the same alignment, the same
                    accent on rule and heading, the same leading, the same face on the Aa */}
                <span className="relative block h-[74px] w-full overflow-hidden rounded-md bg-white px-2.5 py-2 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.07)]">
                  <span
                    className={cn(
                      "pointer-events-none absolute bottom-1.5 right-2 leading-none text-black/20",
                      p.design.font === "sans" ? "font-sans text-[13px]" : "font-serif text-[16px]"
                    )}
                    aria-hidden
                  >
                    Aa
                  </span>
                  {bar(left ? "46%" : "58%", 4, "#000000", 0.78)}
                  {bar(left ? "32%" : "40%", 2, "#000000", 0.3)}
                  <span className="mt-[4px] block" style={{ height: p.design.rule === false ? 0 : 1.5, background: hex }} />
                  <span className="mt-[4px] block">
                    {bar(left ? "28%" : "34%", 3, p.design.headTone === "ink" ? "#000000" : hex, 0.92)}
                  </span>
                  <span className="mt-[3px] flex flex-col" style={{ gap }}>
                    {Array.from({ length: rows }, (_, i) => (
                      <span key={i}>{bar(i === rows - 1 ? "62%" : "100%", 2, "#000000", 0.2)}</span>
                    ))}
                  </span>
                </span>
                <span className="mt-1.5 block truncate text-[11px] font-semibold text-foreground">{p.name}</span>
                <span className="block truncate text-[10px] leading-tight text-muted-foreground">{p.note}</span>
              </button>
            );
          })}
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <Group title="Page">
            <Row label="Format" hint="Letter is 216 × 279mm, for US applications.">
              <SegmentedControl ariaLabel="Page format" size="sm" value={d.page ?? "a4"} onChange={(v) => set("page", v)} options={[{ value: "a4", label: "A4" }, { value: "letter", label: "Letter" }]} />
            </Row>
            <Stepper label="Side margin" suffix="mm" min={8} max={35} value={d.marginX ?? DEFAULTS.marginX} onChange={(v) => set("marginX", v)} />
            <Stepper label="Top & bottom margin" hint="Repeats on every printed page." suffix="mm" min={8} max={35} value={d.marginY ?? DEFAULTS.marginY} onChange={(v) => set("marginY", v)} />
          </Group>

          <Group title="Type & spacing">
            <Row label="Body font" hint="The reference CV is Amiri; Sans reads more neutral.">
              <SegmentedControl ariaLabel="Body font" size="sm" value={d.font ?? "serif"} onChange={(v) => set("font", v)} options={[{ value: "serif", label: "Serif" }, { value: "sans", label: "Sans" }]} />
            </Row>
            <Stepper label="Base font size" suffix="pt" step={0.5} decimals={1} min={6} max={16} value={d.base ?? DEFAULTS.base} onChange={(v) => set("base", v)} />
            <Stepper label="Name" hint="Relative to the base size." suffix="pt" min={-14} max={30} value={d.nameDelta ?? 0} onChange={(v) => set("nameDelta", v)} />
            <Stepper label="Section headings" suffix="pt" min={-6} max={16} value={d.headDelta ?? 0} onChange={(v) => set("headDelta", v)} />
            <Stepper label="Entry titles" suffix="pt" min={-5} max={14} value={d.entryDelta ?? 0} onChange={(v) => set("entryDelta", v)} />
            <Stepper label="Line height" step={0.05} decimals={2} min={1} max={2.2} value={d.lineHeight ?? DEFAULTS.lineHeight} onChange={(v) => set("lineHeight", v)} />
            <Stepper label="Space between sections" suffix="px" min={6} max={40} value={d.sectionGap ?? DEFAULTS.sectionGap} onChange={(v) => set("sectionGap", v)} />
            <Stepper label="Space between entries" suffix="px" min={2} max={30} value={d.entryGap ?? DEFAULTS.entryGap} onChange={(v) => set("entryGap", v)} />
          </Group>

          <Group title="Sections">
            <Row label="Heading case">
              <SegmentedControl
                ariaLabel="Heading case"
                size="sm"
                value={d.caps ?? "none"}
                onChange={(v) => set("caps", v)}
                options={[
                  { value: "none", label: "As is" },
                  { value: "capitalize", label: "Title" },
                  { value: "upper", label: "UPPER" },
                ]}
              />
            </Row>
            <div className="py-1.5">
              <Switch checked={d.rule !== false} onChange={(v) => set("rule", v)} label="Rule under headings" hint="The hairline and its accent colour." />
            </div>
            <Row label="Heading glyph" hint="A glyph beside each section heading.">
              <SegmentedControl
                ariaLabel="Heading glyph"
                size="sm"
                value={d.headIcons ?? "none"}
                onChange={(v) => set("headIcons", v)}
                options={[
                  { value: "none", label: "None" },
                  { value: "outline", label: "Outline" },
                  { value: "filled", label: "Filled" },
                ]}
              />
            </Row>
            <Stepper label="Skill columns" min={1} max={4} value={d.skillCols ?? DEFAULTS.skillCols} onChange={(v) => set("skillCols", v)} />
            <Row label="Date & location" hint="Which side of the entry they sit on.">
              <SegmentedControl
                ariaLabel="Date position"
                size="sm"
                value={d.datePos ?? "left"}
                onChange={(v) => set("datePos", v)}
                options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]}
              />
            </Row>
            <Row label="Date format">
              <SegmentedControl
                ariaLabel="Date format"
                size="sm"
                value={d.dates ?? "keep"}
                onChange={(v) => set("dates", v)}
                options={[
                  { value: "keep", label: "2026-07" },
                  { value: "month", label: "Jul 2026" },
                  { value: "dots", label: "07.2026" },
                  { value: "hide", label: "None" },
                ]}
              />
            </Row>
          </Group>

          <Group title="Colour & details">
            <Row label="Accent">
              <SegmentedControl ariaLabel="Accent colour" size="sm" value={d.accent ?? "ink"} onChange={(v) => set("accent", v)} options={ACCENTS} />
            </Row>
            <Row label="Accent area" hint="Ink keeps even the rules black.">
              <SegmentedControl
                ariaLabel="Accent area"
                size="sm"
                value={d.headTone ?? "accent"}
                onChange={(v) => set("headTone", v)}
                options={[{ value: "accent", label: "Headings" }, { value: "ink", label: "Rules only" }]}
              />
            </Row>
            <Row label="Header alignment">
              <SegmentedControl
                ariaLabel="Header alignment"
                size="sm"
                value={d.align ?? "center"}
                onChange={(v) => set("align", v)}
                options={[{ value: "center", label: "Center" }, { value: "left", label: "Left" }]}
              />
            </Row>
            <Row label="Contact icon frame">
              <SegmentedControl
                ariaLabel="Contact icon frame"
                size="sm"
                value={d.icons ?? "none"}
                onChange={(v) => set("icons", v)}
                options={[
                  { value: "none", label: "None" },
                  { value: "circle", label: "Circle" },
                  { value: "rounded", label: "Rounded" },
                  { value: "square", label: "Square" },
                  { value: "circle-fill", label: "Filled" },
                ]}
              />
            </Row>
            <div className="py-1.5">
              <Switch checked={!!links.underline} onChange={(v) => set("links", { ...links, underline: v })} label="Underline links" />
            </div>
            <div className="py-1.5">
              <Switch checked={!!links.colored} onChange={(v) => set("links", { ...links, colored: v })} label="Colour links" hint="Not every ATS reads coloured text as a link." />
            </div>
          </Group>
        </div>
      )}
    </Card>
  );
}
