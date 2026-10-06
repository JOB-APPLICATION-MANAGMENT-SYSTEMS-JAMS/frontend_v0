"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/** One toast policy (§9.2): mutations dispatch window "jams-toast", ToastHost renders them. */
export type ToastItem = { id: number; message: string; kind: "success" | "error" | "info"; title?: string; leaving?: boolean };

export function toast(message: string, kind: ToastItem["kind"] = "info", title?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("jams-toast", { detail: { message, kind, title } }));
}

const VISIBLE_MS = 4800;
const LEAVE_MS = 240; // matches the .toast-out animation
const MAX_LIVE = 4;

export function useToasts(): ToastItem[] {
  const [items, setItems] = useState<ToastItem[]>([]);
  const itemsRef = useRef<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>[]>());

  // stable callbacks (deps stay empty → the listener effect below mounts exactly once)
  const commit = useCallback((next: ToastItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const clearTimers = useCallback((id: number) => {
    for (const t of timers.current.get(id) ?? []) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const remove = useCallback(
    (id: number) => {
      clearTimers(id);
      commit(itemsRef.current.filter((i) => i.id !== id));
    },
    [clearTimers, commit]
  );

  const schedule = useCallback(
    (id: number) => {
      clearTimers(id);
      const leave = setTimeout(() => {
        commit(itemsRef.current.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
      }, VISIBLE_MS);
      const gone = setTimeout(() => remove(id), VISIBLE_MS + LEAVE_MS);
      timers.current.set(id, [leave, gone]);
    },
    [clearTimers, commit, remove]
  );

  useEffect(() => {
    // copy the ref once: the cleanup must not depend on what it points to later
    const activeTimers = timers.current;
    let n = 0;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const message = String(detail.message ?? "");
      const kind: ToastItem["kind"] =
        detail.kind ?? (message?.startsWith?.("Failed") || message?.includes?.("failed") ? "error" : "info");
      const title = detail.title;

      // Dedupe: one action often fires both the page handler and the global
      // mutation cache (and impatient clicks fire twice) — the same live message
      // restarts its timer instead of stacking a second card.
      const live = itemsRef.current.find((i) => !i.leaving && i.message === message && (i.title ?? "") === (title ?? ""));
      if (live) {
        schedule(live.id);
        return;
      }

      const item: ToastItem = { id: ++n, message, kind, title };
      const next = [...itemsRef.current, item].slice(-MAX_LIVE);
      for (const kept of itemsRef.current) if (!next.includes(kept)) clearTimers(kept.id);
      commit(next);
      schedule(item.id);
    };
    const dismiss = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (typeof id === "number") remove(id);
    };
    window.addEventListener("jams-toast", handler);
    window.addEventListener("jams-toast-dismiss", dismiss);
    return () => {
      window.removeEventListener("jams-toast", handler);
      window.removeEventListener("jams-toast-dismiss", dismiss);
      for (const [, list] of activeTimers) for (const t of list) clearTimeout(t);
      activeTimers.clear();
    };
  }, [clearTimers, commit, remove, schedule]);

  return items;
}
