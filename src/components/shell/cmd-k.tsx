"use client";

/**
 * ⌘K command palette — "Palette Pop" (spec §13): the only blurred surface while open,
 * panel springs .96→1, recent items cascade with 30ms stagger (§17: one heavy at a time).
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command as CommandIcon, Compass, Crosshair, FilePlus2, Flame, LayoutDashboard, Mail, Search, Send, UserRound, Columns3, ChartLine, Trophy } from "lucide-react";
import { appFetch } from "@/lib/api";
import type { Application, Paged } from "@/types";
import { Kbd } from "@/components/ui/base";
import { cn } from "@/lib/utils";

type Cmd = { id: string; label: string; hint?: string; icon: any; run: () => void; group: string };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { data: appResults } = useQuery({
    queryKey: ["palette", "apps", q],
    queryFn: () => appFetch<Paged<Application>>("/applications", { params: { q, page_size: 6 }, _auth: true }),
    enabled: open && q.length > 1,
    staleTime: 15_000,
  });

  const go = React.useCallback(
    (href: string) => {
      onClose();
      setQ("");
      router.push(href);
    },
    [onClose, router]
  );

  const commands: Cmd[] = [
    { id: "dash", label: "Dashboard", hint: "g d", icon: LayoutDashboard, run: () => go("/dashboard"), group: "Go" },
    { id: "disc", label: "Discover jobs", icon: Compass, run: () => go("/discover"), group: "Go" },
    { id: "track", label: "Tracker board", icon: Columns3, run: () => go("/tracker"), group: "Go" },
    { id: "streak", label: "Streaks & goals", icon: Flame, run: () => go("/streaks"), group: "Go" },
    { id: "analyt", label: "Analytics", icon: ChartLine, run: () => go("/analytics"), group: "Go" },
    { id: "prof", label: "Profile (master form)", icon: UserRound, run: () => go("/profile"), group: "Go" },
    { id: "victory", label: "I got a job 🎉", icon: Trophy, run: () => go("/victory"), group: "Go" },
    { id: "newapp", label: "Log an application", hint: "c", icon: FilePlus2, run: () => go("/tracker?new=1"), group: "Actions" },
    { id: "capture", label: "Quick capture (paste URL)", icon: Crosshair, run: () => go("/capture"), group: "Actions" },
    { id: "newcv", label: "New CV", icon: FilePlus2, run: () => go("/studio?new=1"), group: "Actions" },
    { id: "compose", label: "Compose cold email", icon: Send, run: () => go("/outreach?compose=1"), group: "Actions" },
    { id: "inbox", label: "Connect mailbox", icon: Mail, run: () => go("/inbox-sync"), group: "Actions" },
  ];

  const filteredCmds = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  const appCmds: Cmd[] = (appResults?.items ?? []).map((a) => ({
    id: `app-${a.id}`,
    label: `${a.role_title} — ${a.company_name}`,
    hint: a.status,
    icon: Columns3,
    run: () => go(`/applications/${a.id}`),
    group: "Applications",
  }));
  const items = [...filteredCmds, ...appCmds].slice(0, 12);

  React.useEffect(() => {
    if (open) {
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(items.length - 1, c + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      }
      if (e.key === "Enter" && items[cursor]) items[cursor].run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, cursor, onClose]);

  if (!open) return null;

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-xl" onClick={onClose}>
      <div
        className="route-fade w-full max-w-xl overflow-hidden rounded-2xl border border-white/20 shadow-2xl"
        style={{ background: "hsl(var(--surface) / 0.92)", transform: "scale(1)", animation: "fadeInUp .18s cubic-bezier(.23,1,.32,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <CommandIcon className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a page, an application, or an action…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2 custom-scrollbar">
          {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches — try “capture” or a company name.</p>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <React.Fragment key={item.id}>
                {header && <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{header}</p>}
                <button
                  onMouseEnter={() => setCursor(i)}
                  onClick={item.run}
                  className={cn(
                    "animate-stagger flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm",
                    i === cursor ? "bg-[image:var(--gradient-brand)] text-white" : "text-foreground hover:bg-muted"
                  )}
                  style={{ ["--i" as any]: i }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className={cn("text-[10px] uppercase", i === cursor ? "text-white/80" : "text-muted-foreground")}>{item.hint}</span>}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate <Kbd className="ml-2">↵</Kbd> open <Kbd className="ml-2">esc</Kbd> close
        </div>
      </div>
    </div>
  );
}
