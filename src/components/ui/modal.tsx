"use client";

/**
 * Viewport-centered modal + info (i) icon.
 *
 * Rendered through a portal into document.body on purpose: <main> carries the
 * `route-fade` animation (fill-mode: both, ends on transform: translateY(0)),
 * which makes it the containing block for position:fixed descendants. Without
 * the portal, a fixed backdrop centers against the whole page height and the
 * user has to scroll to find it (worst on long pages like Tracker).
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { Button } from "./base";

export function Modal({
  open,
  onClose,
  label,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const mounted = useMounted();
  useScrollLock(open);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="scrim-in fixed inset-0 z-[110] grid place-items-center bg-black/55 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className={cn("glass-panel sheet-in max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl p-5", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Escapes transformed ancestors (e.g. `route-fade` on <main>) by rendering into document.body. */
export function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/** Small (i) badge; clicking opens a plain-language explanation of the section it sits next to. */
export function InfoButton({ title, body, className }: { title: string; body: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`What is ${title}?`}
        title={`What is ${title}?`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "touch-slop inline-grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-all duration-[var(--dur-2)] hover:border-ember/60 hover:bg-ember/10 hover:text-ember-deep dark:hover:text-ember-soft",
          className
        )}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label={title} className="max-w-md">
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-base font-bold">{title}</p>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{body}</div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Got it
          </Button>
        </div>
      </Modal>
    </>
  );
}
