"use client";

/** Feedback vocabulary (§9.2 / §14.2): empty, error, banners, toasts. */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, Card } from "./base";
import { Modal } from "./modal";
import { AlertTriangle, CheckCircle2, Inbox, Info, X } from "lucide-react";
import { useToasts, type ToastItem } from "@/hooks/use-toast";

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">{icon ?? <Inbox className="h-6 w-6" />}</span>
      <div>
        <p className="font-display text-base font-semibold text-foreground">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </Card>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <Card className="border-destructive/50 px-6 py-8 text-center">
      <p className="font-display text-base font-semibold text-destructive">Couldn’t load this view</p>
      <p className="mt-1 font-mono text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function InlineBanner({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "danger" | "success"; title?: string; children: React.ReactNode; className?: string }) {
  const tones = {
    info: "glass-azure text-foreground",
    warn: "glass-amber text-amber-800 dark:text-amber-100",
    danger: "glass-rose text-rose-800 dark:text-rose-100",
    success: "glass-mint text-emerald-800 dark:text-emerald-100",
  };
  const Icon = tone === "warn" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm", tones[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "opacity-90" : ""}>{children}</div>
      </div>
    </div>
  );
}

/** Confirm modal: destructive actions only (sign-out, delete). Esc or backdrop cancels. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} label={title} className="max-w-sm">
      <p className="font-display text-base font-bold">{title}</p>
      {description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/** Top-center toasts: all cards share one slot (newest overlays the older ones),
 *  surface-colored (black-on-white text flips with the theme), short and wide (§9.2 / §41.5). */
export function ToastHost() {
  const items = useToasts();
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex justify-center px-4">
      {/* zero-height track: every toast lands at the same spot and overlays the
          previous card instead of pushing a column down the screen */}
      <div className="relative h-0 w-full max-w-[min(92vw,560px)]">
        {items.map((t) => (
          <div key={t.id} className="absolute inset-x-0 top-0">
            <ToastCard item={t} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = () => window.dispatchEvent(new CustomEvent("jams-toast-dismiss", { detail: { id: item.id } }));
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground shadow-2xl",
        item.leaving ? "toast-out" : "toast-in",
        item.kind === "success" && "border-l-4 border-l-[image:var(--gradient-brand)]",
        item.kind === "error" && "border-l-4 border-l-destructive"
      )}
    >
      <div className="min-w-0 flex-1">
        {item.title && <p className="font-semibold">{item.title}</p>}
        <p className={cn("break-words", item.title && "opacity-80")}>{item.message}</p>
      </div>
      <button
        aria-label="Dismiss notification"
        onClick={dismiss}
        className="-mr-2 -my-2 shrink-0 self-stretch rounded-lg p-2.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
