"use client";

/**
 * The CV shelf, a row of glass folders on the Studio page.
 *
 * The same CVs the grid below lists, but as objects you can open: one folder per
 * archetype, folded out of milk glass over a generated artwork, holding your CVs
 * as paper sheets, each one a white tab with the CV's name on it. Hover lists the
 * five newest and turns to the next five every few seconds; click a name to open
 * that CV, the ··· key for the folder's own actions (new CV here, fork, print),
 * Esc or a click outside to close it.
 *
 * The folder reads its `files` once and then owns the list, so the folder is
 * keyed on the ids it was given: create or delete a CV and the folder remounts
 * with the true set, instead of accumulating optimistic sheets that never existed.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import GlassFolder, { type FolderFile, type FolderMenuItem } from "@/components/ui/glass-folder-cards";
import type { CV, Template } from "@/types";
import { toast } from "@/hooks/use-toast";
import { fmt } from "@/lib/utils";

type Group = { key: string; label: string; art: "aurora" | "ember" | "dusk" | "verdant" | "glacier"; seed: number; items: CV[] };

const ART: Record<string, Group["art"]> = { opening: "aurora", pitch: "ember" };
const SEED: Record<string, number> = { opening: 3, pitch: 11 };

export function CvShelf({
  cvs,
  templates,
  onCreate,
  onFork,
  width = 320,
}: {
  cvs: CV[];
  templates: Template[];
  /** Create a CV in this archetype; the page owns the mutation. */
  onCreate: (archetype: "opening" | "pitch") => void;
  /** Fork a CV by id. */
  onFork: (id: string) => void;
  width?: number;
}) {
  const router = useRouter();

  /**
   * The folder is drawn at a fixed pixel width and scales everything with it, so
   * it cannot be sized by CSS alone: a 320px folder inside a 256px card clipped
   * its right edge on a 320px phone. Measure the row and hand the folder the
   * width it actually has, capped at the designed size.
   */
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  const [fitted, setFitted] = React.useState(width);

  React.useEffect(() => {
    const el = rowRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const avail = el.clientWidth;
      if (avail > 0) setFitted(Math.max(240, Math.min(width, Math.floor(avail))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const groups = React.useMemo<Group[]>(() => {
    const by = new Map<string, CV[]>();
    for (const cv of cvs) {
      const key = cv.archetype === "pitch" ? "pitch" : "opening";
      const list = by.get(key);
      if (list) list.push(cv);
      else by.set(key, [cv]);
    }
    return [...by.entries()]
      .sort(([a], [b]) => (a === "opening" ? -1 : 1) - (b === "opening" ? -1 : 1))
      .map(([key, items]) => ({
        key,
        label: key === "pitch" ? "Pitch CVs" : "Opening CVs",
        art: ART[key] ?? "dusk",
        seed: SEED[key] ?? 5,
        items: [...items].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)),
      }));
  }, [cvs]);

  const folders: { key: string; label: string; art: Group["art"]; seed: number; files: FolderFile[]; ids: string[]; menu: FolderMenuItem[] }[] =
    React.useMemo(() => {
      const out = groups.map((g) => {
        const newest = g.items[0];
        const menu: FolderMenuItem[] = [
          { label: `New ${g.key} CV`, onSelect: () => onCreate(g.key as "opening" | "pitch") },
        ];
        if (newest) {
          menu.push({ label: "Fork newest", onSelect: () => onFork(newest.id) });
          menu.push({ label: "Print newest", onSelect: () => router.push(`/studio/cvs/${newest.id}?print=1`) });
        }
        return {
          key: g.key,
          label: g.label,
          art: g.art,
          seed: g.seed,
          ids: g.items.map((c) => c.id),
          menu,
          // no `art` on a file, so each one is drawn as a sheet of paper. Every CV
          // is handed over; the folder shows them five at a time, newest first.
          // the name is the point, so the second line stays short: when this CV
          // was last touched, which also tells the fresh ones apart at a glance
          files: g.items.map((cv) => ({ name: cv.name, meta: fmt.ago(cv.updated_at) })),
        };
      });

      // the template library is the third folder on the desk; a template is a
      // page you copy, so selecting one puts its body on the clipboard
      if (templates.length) {
        out.push({
          key: "templates",
          label: "Templates",
          art: "verdant",
          seed: 7,
          ids: templates.map((t) => t.id),
          menu: [{ label: "New CV from a template", onSelect: () => onCreate("opening") }],
          files: templates.map((t) => ({ name: t.name, meta: t.archetype })),
        });
      }
      return out;
    }, [groups, templates, onCreate, onFork, router]);

  if (!folders.length) return null;

  const pick = (folder: (typeof folders)[number], index: number) => {
    const id = folder.ids[index];
    if (!id) return;
    if (folder.key === "templates") {
      const t = templates.find((x) => x.id === id);
      if (!t) return;
      void navigator.clipboard
        ?.writeText(t.body)
        .then(() => toast(`“${t.name}” copied - paste it into a new CV`, "success"))
        .catch(() => toast("Couldn't reach the clipboard", "error"));
      return;
    }
    router.push(`/studio/cvs/${id}`);
  };

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="eyebrow">Shelf</h2>
        {/* a phone has no hover: say what the gesture actually is instead of
            instructing a thumb to hover. Two spans, switched by the pointer. */}
        {/* tracking shrinks on a phone so the whole hint fits the card instead of
            being sliced at the right edge, and the actions suffix only shows where
            there is room for it */}
        <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground sm:text-[10px] sm:tracking-[0.18em]">
          <span className="hidden [@media(hover:hover)]:inline">hover to turn the pages · click a name to open</span>
          <span className="[@media(hover:hover)]:hidden">tap a folder to fan it · tap a name to open</span>
          <span className="hidden sm:inline"> · ··· for actions</span>
        </p>
      </div>
      <div ref={rowRef} className="flex flex-wrap items-start justify-center gap-x-8 gap-y-1">
        {folders.map((f, i) => (
          <GlassFolder
            // remount on a real change of contents, never on a refetch of the same set
            key={`${f.key}:${f.ids.join(",")}`}
            label={f.label}
            meta={`${f.ids.length} ${f.ids.length === 1 ? "CV" : "CVs"}`}
            art={f.art}
            seed={f.seed}
            files={f.files}
            action="more"
            menu={f.menu}
            width={fitted}
            appearDelay={i * 130}
            labelPlacement={i % 2 === 1 ? "top-left" : "bottom-left"}
            onFileSelect={(_file, index) => pick(f, index)}
          />
        ))}
      </div>
    </div>
  );
}
