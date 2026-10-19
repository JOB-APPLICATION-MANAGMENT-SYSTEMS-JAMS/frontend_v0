"use client";

/**
 * CV editor, modelled on how FlowCV's editor feels: a column of collapsible
 * sections, real bullet rows instead of one blob of text, and an "add section"
 * affordance at the end.
 *
 * Why rows and not a textarea: a CV bullet is a unit of writing. Rows let you
 * reorder, delete and insert one bullet without disturbing the rest, and they
 * stop the classic paste failure where two bullets collapse into one line.
 * Everything still serialises to the existing `text` field (newline separated),
 * so the renderer and the stored shape are untouched.
 */
import * as React from "react";
import {
  Award,
  BookOpen,
  Briefcase,
  ChevronDown,
  Eye,
  EyeOff,
  FolderGit2,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
  Type,
  Wand2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Label, Textarea } from "@/components/ui/base";
import { Switch } from "@/components/ui/toggle";
import type { CV, CVBlock } from "@/types";

const TYPE_LABEL: Record<CVBlock["type"], string> = {
  summary: "Professional summary",
  experience: "Experience",
  skills: "Skills",
  projects: "Projects",
  education: "Education",
  awards: "Awards",
  custom: "Custom section",
};

const TYPE_ICON: Record<CVBlock["type"], React.ComponentType<{ className?: string }>> = {
  summary: Sparkles,
  experience: Briefcase,
  skills: Wand2,
  projects: FolderGit2,
  education: BookOpen,
  awards: Award,
  custom: Type,
};

const ADDABLE: CVBlock["type"][] = ["summary", "experience", "skills", "projects", "education", "awards", "custom"];

const lines = (t?: string) => String(t ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

export function CvEditor({ draft, onChange }: { draft: CV; onChange: (next: CV) => void }) {
  // accordion: several sections can be open at once, the way FlowCV behaves
  const [open, setOpen] = React.useState<Record<number, boolean>>({ 0: true });
  const [hidden, setHidden] = React.useState<Record<number, boolean>>({});
  const sectionRefs = React.useRef<Record<number, HTMLElement | null>>({});

  const patch = (i: number, block: Partial<CVBlock>) =>
    onChange({ ...draft, blocks: draft.blocks.map((b, idx) => (idx === i ? { ...b, ...block } : b)) });

  const remove = (i: number) => onChange({ ...draft, blocks: draft.blocks.filter((_, idx) => idx !== i) });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.blocks.length) return;
    const next = [...draft.blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...draft, blocks: next });
    setOpen((o) => ({ ...o, [i]: o[j], [j]: o[i] }));
  };

  const jump = (i: number) => {
    setOpen((o) => ({ ...o, [i]: true }));
    sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const add = (type: CVBlock["type"]) =>
    onChange({
      ...draft,
      blocks: [
        ...draft.blocks,
        type === "skills" ? { type, title: TYPE_LABEL.skills, groups: [""] } : { type, title: TYPE_LABEL[type], text: "", source: "local" },
      ],
    });

  return (
    <div className="space-y-3">
      {draft.blocks.length > 2 && (
        /* section index: on a long CV the useful navigation is the section list,
           not the scrollbar */
        <nav className="glass-sheet flex flex-wrap gap-1.5 rounded-xl p-2">
          <span className="eyebrow shrink-0 self-center px-1">Jump to</span>
          {draft.blocks.map((b, i) => (
            <button
              key={i}
              type="button"
              onClick={() => jump(i)}                className={cn(
                  "glass-chip touch-slop shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                hidden[i] ? "text-muted-foreground line-through" : "text-foreground hover:border-ember/50 hover:text-ember-deep dark:hover:text-ember-soft"
              )}
            >
              {b.title || TYPE_LABEL[b.type]}
            </button>
          ))}
        </nav>
      )}

      {draft.blocks.map((b, i) => {
        const Icon = TYPE_ICON[b.type];
        const isOpen = open[i] ?? false;
        const bulletType = b.type === "experience" || b.type === "education" || b.type === "projects" || b.type === "awards";
        // only experience, education and skills can render live from the profile;
        // a summary (or any other block) marked "profile" would wear the badge
        // while printing nothing, so the badge follows what the document honours
        const linked = b.source === "profile" && (b.type === "experience" || b.type === "education" || b.type === "skills");
        const count = b.type === "skills" ? (b.groups ?? []).filter(Boolean).length : lines(b.text).length;

        return (
          <section
            key={i}
            ref={(node) => {
              sectionRefs.current[i] = node;
            }}
            data-hidden={hidden[i] ? "true" : undefined}
            className={cn(
              "glass-card overflow-hidden rounded-2xl transition-all duration-[var(--dur-2)]",
              hidden[i] && "opacity-55"
            )}
          >
            {/* On a phone the four section actions leave the title about 60px,
                which truncated "Experience" to "Experi…" - the one label that
                has to stay legible. The title takes its own row below `sm` and
                the actions sit under it, right-aligned. */}
            <header className="flex flex-wrap items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [i]: !isOpen }))}
                aria-expanded={isOpen}
                className="flex min-w-0 flex-1 basis-full cursor-pointer items-center gap-2.5 text-left sm:basis-auto"
              >
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                    isOpen ? "bg-ember/16 text-ember-deep dark:text-ember-soft" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-display text-sm font-bold">{b.title || TYPE_LABEL[b.type]}</span>
                    {linked && (
                      <span className="shrink-0 rounded-full bg-ember/14 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ember-deep dark:text-ember-soft">
                        profile
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {count ? `${count} ${b.type === "skills" ? (count === 1 ? "group" : "groups") : count === 1 ? "line" : "lines"}` : "empty"}
                  </span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-[var(--dur-3)]", isOpen && "rotate-180")} />
              </button>

              <div className="ml-auto flex shrink-0 items-center">
                <IconAction label={hidden[i] ? "Show section" : "Hide section"} onClick={() => setHidden((h) => ({ ...h, [i]: !h[i] }))}>
                  {hidden[i] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </IconAction>
                <IconAction label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </IconAction>
                <IconAction label="Move down" onClick={() => move(i, 1)} disabled={i === draft.blocks.length - 1}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </IconAction>
                <IconAction label="Delete section" danger onClick={() => remove(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconAction>
              </div>
            </header>

            {isOpen && (
              <div className="animate-fade-in space-y-3 border-t border-border p-3">
                {(b.type === "custom" || b.type === "projects" || b.type === "awards" || b.type === "experience" || b.type === "education") && (
                  <div>
                    <Label htmlFor={`blk-title-${i}`}>Section title</Label>
                    <Input
                      id={`blk-title-${i}`}
                      value={b.title ?? ""}
                      onChange={(e) => patch(i, { title: e.target.value })}
                      placeholder={TYPE_LABEL[b.type]}
                    />
                  </div>
                )}

                {(b.type === "experience" || b.type === "education" || b.type === "skills") && (
                  <LinkToggle linked={linked} onChange={(v) => patch(i, { source: v ? "profile" : "local" })} />
                )}

                {b.type === "skills" ? (
                  <SkillsEditor groups={b.groups ?? []} onChange={(groups) => patch(i, { groups })} />
                ) : bulletType ? (
                  <BulletEditor
                    text={b.text ?? ""}
                    onChange={(text) => patch(i, { text })}
                    label={linked ? "Extra lines (print below your profile entries)" : "Bullets"}
                  />
                ) : (
                  <ProseEditor text={b.text ?? ""} onChange={(text) => patch(i, { text })} />
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* add section: one row of chips, no nested menu to hunt through */}
      <div className="glass-sheet rounded-2xl p-3">
        <p className="eyebrow mb-2">Add a section</p>
        <div className="flex flex-wrap gap-1.5">
          {ADDABLE.map((t) => {
            const Icon = TYPE_ICON[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => add(t)}
                className="glass-chip touch-slop inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-foreground transition-all duration-[var(--dur-2)] hover:border-ember/50 hover:text-ember-deep dark:hover:text-ember-soft"
              >
                <Icon className="h-3.5 w-3.5" />
                {TYPE_LABEL[t]}
                <Plus className="h-3 w-3 opacity-60" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function IconAction({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // touch-slop keeps the 32px visual size but gives a thumb a 44px target
        "touch-slop grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-30",
        danger ? "hover:bg-ink/10 hover:text-destructive" : "hover:bg-ember/10 hover:text-ember-deep dark:hover:text-ember-soft"
      )}
    >
      {children}
    </button>
  );
}

/** Bullet rows. Enter adds, Backspace on an empty row removes, Alt+↑/↓ reorders. */
function BulletEditor({ text, onChange, label }: { text: string; onChange: (t: string) => void; label: string }) {
  const rows = React.useMemo(() => {
    const arr = text.split("\n");
    return arr.length ? arr : [""];
  }, [text]);
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  /**
   * Row focus is carried through a ref and applied in the effect that already runs
   * after the parent re-renders from the write. Holding it in state would mean
   * calling setState inside an effect (a cascading render) just to focus a field.
   */
  const pendingFocus = React.useRef<number | null>(null);

  React.useEffect(() => {
    const target = pendingFocus.current;
    if (target == null) return;
    pendingFocus.current = null;
    refs.current[target]?.focus();
  }, [text]);

  const write = (next: string[]) => onChange(next.join("\n"));

  const setRow = (i: number, value: string) => write(rows.map((r, idx) => (idx === i ? value : r)));

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const next = [...rows.slice(0, i + 1), "", ...rows.slice(i + 1)];
      pendingFocus.current = i + 1;
      write(next);
    } else if (e.key === "Backspace" && rows[i] === "" && rows.length > 1) {
      e.preventDefault();
      pendingFocus.current = Math.max(0, i - 1);
      write(rows.filter((_, idx) => idx !== i));
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const j = i + (e.key === "ArrowUp" ? -1 : 1);
      if (j < 0 || j >= rows.length) return;
      const next = [...rows];
      [next[i], next[j]] = [next[j], next[i]];
      pendingFocus.current = j;
      write(next);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="mb-0">{label}</Label>
        {/* a keyboard hint is noise on a thumb-only screen */}
        <span className="hidden text-[10px] text-muted-foreground sm:inline">Enter = new bullet · Alt+↑↓ = reorder</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="grid h-6 w-4 shrink-0 place-items-center text-ember">
              <span className="h-1.5 w-1.5 rounded-full bg-ember" />
            </span>
            <input
              ref={(node) => {
                refs.current[i] = node;
              }}
              value={row}
              onChange={(e) => setRow(i, e.target.value)}
              onKeyDown={(e) => onKey(e, i)}
              placeholder={i === 0 ? "Cut onboarding time 40% by rebuilding the design system" : "Another result, with a number in it"}
              aria-label={`${label} line ${i + 1}`}
              className="glass-input h-9 min-w-0 flex-1 rounded-lg px-3 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            />
            {rows.length > 1 && (
              <button
                type="button"
                aria-label={`Remove line ${i + 1}`}
                title="Remove line"
                onClick={() => write(rows.filter((_, idx) => idx !== i))}
                className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ink/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          pendingFocus.current = rows.length;
          write([...rows, ""]);
        }}
        className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
      >
        <Plus className="h-3 w-3" /> Add bullet
      </button>
    </div>
  );
}

/** Skill groups: one row per line the CV prints, comma separated inside a row. */
function SkillsEditor({ groups, onChange }: { groups: string[]; onChange: (g: string[]) => void }) {
  const rows = groups.length ? groups : [""];
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const pendingFocus = React.useRef<number | null>(null);

  React.useEffect(() => {
    const target = pendingFocus.current;
    if (target == null) return;
    pendingFocus.current = null;
    refs.current[target]?.focus();
  }, [groups]);

  const write = (next: string[]) => onChange(next);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="mb-0">Skill groups</Label>
        <span className="text-[10px] text-muted-foreground">comma separated · one line = one group</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            <input
              ref={(node) => {
                refs.current[i] = node;
              }}
              value={row}
              onChange={(e) => write(rows.map((r, idx) => (idx === i ? e.target.value : r)))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  pendingFocus.current = i + 1;
                  write([...rows.slice(0, i + 1), "", ...rows.slice(i + 1)]);
                } else if (e.key === "Backspace" && row === "" && rows.length > 1) {
                  e.preventDefault();
                  pendingFocus.current = Math.max(0, i - 1);
                  write(rows.filter((_, idx) => idx !== i));
                }
              }}
              placeholder={i === 0 ? "TypeScript, React, Next.js, Node.js" : "Accessibility, testing, CI"}
              aria-label={`Skill group ${i + 1}`}
              className="glass-input h-9 min-w-0 flex-1 rounded-lg px-3 text-[13px] text-foreground placeholder:text-muted-foreground/70"
            />
            {rows.length > 1 && (
              <button
                type="button"
                aria-label={`Remove group ${i + 1}`}
                onClick={() => write(rows.filter((_, idx) => idx !== i))}
                className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ink/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          pendingFocus.current = rows.length;
          write([...rows, ""]);
        }}
        className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
      >
        <Plus className="h-3 w-3" /> Add group
      </button>
      {rows.some(Boolean) && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Prints as: <span className="text-foreground">{rows.filter(Boolean).join(" · ")}</span>
        </p>
      )}
    </div>
  );
}

/** Prose blocks (summary, custom): paragraphs, with an honest word count. */
function ProseEditor({ text, onChange }: { text: string; onChange: (t: string) => void }) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const long = words > 120;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="mb-0">Text</Label>
        <span className={cn("text-[10px] tabular-nums", long ? "text-ember-deep dark:text-ember-soft" : "text-muted-foreground")}>
          {words} words{long && " · recruiters skim past ~120"}
        </span>
      </div>
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder="Two or three sentences on what you do and the scale you have done it at. Blank line starts a new paragraph."
      />
    </div>
  );
}

/**
 * The profile link. A section either renders live from the master Profile or is
 * local to this CV - that distinction was a badge before, now it is the control.
 */
function LinkToggle({ linked, onChange }: { linked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      checked={linked}
      onChange={onChange}
      label={linked ? "Synced from Profile" : "Edited just here"}
      hint={linked ? "Edits live on the Profile page and flow into every CV." : "Only this CV changes, your master profile is untouched."}
    />
  );
}

export { TYPE_LABEL };
