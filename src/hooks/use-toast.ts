"use client";

import { useEffect, useState } from "react";

/** One toast policy (§9.2): mutations dispatch window "jams-toast", ToastHost renders them. */
export type ToastItem = { id: number; message: string; kind: "success" | "error" | "info"; title?: string };

export function toast(message: string, kind: ToastItem["kind"] = "info", title?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("jams-toast", { detail: { message, kind, title } }));
}

export function useToasts(): ToastItem[] {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    let n = 0;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const item: ToastItem = { id: ++n, message: String(detail.message ?? ""), kind: detail.kind ?? (detail.message?.startsWith?.("Failed") || detail.message?.includes?.("failed") ? "error" : "info"), title: detail.title };
      setItems((prev) => [...prev.slice(-3), item]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== item.id)), 5200);
    };
    window.addEventListener("jams-toast", handler);
    return () => window.removeEventListener("jams-toast", handler);
  }, []);
  return items;
}
