"use client";

/** Primitives (§14.2) — variants are semantic, not decorative (CVA-style map). */
import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------- Button ------------------------------- */
type ButtonVariant = "default" | "destructive" | "outline" | "ghost" | "link" | "secondary" | "success" | "warning" | "azure";
type ButtonSize = "sm" | "default" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-black/10 dark:shadow-black/40",
  destructive: "bg-destructive text-white hover:opacity-90",
  outline: "border border-border bg-transparent hover:bg-muted text-foreground",
  ghost: "hover:bg-muted text-foreground",
  link: "text-accent underline-offset-4 hover:underline",
  secondary: "bg-muted text-foreground hover:bg-muted/70",
  success: "bg-success text-white hover:opacity-90",
  warning: "bg-warning text-white hover:opacity-90",
  /* the primary CTA everywhere: inverse pill, no hue (Giga-style) */
  azure: "bg-foreground text-background hover:opacity-90 shadow-lg shadow-black/10 dark:shadow-black/40",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  default: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "h-9 w-9",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ className, variant = "default", size = "default", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-medium transition-all duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "active:scale-95 disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
});

/* -------------------------------- Input -------------------------------- */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "glass-input h-10 w-full rounded-xl px-3.5 text-sm text-foreground placeholder:text-muted-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "glass-input min-h-[96px] w-full rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className
        )}
        {...props}
      />
    );
  }
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn("glass-input h-10 w-full cursor-pointer rounded-xl px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring", className)}
        {...props}
      >
        {children}
      </select>
    );
  }
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", className)} {...props} />;
}

/* -------------------------------- Card --------------------------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-card rounded-2xl", className)} {...props} />;
}

/* -------------------------------- Badge -------------------------------- */
export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "mint" | "azure" | "orchid" | "amber" | "rose" }) {
  const tones = {
    neutral: "bg-muted text-muted-foreground border-border",
    mint: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    azure: "bg-orange-600/12 text-orange-700 dark:text-orange-400 border-orange-600/35",
    orchid: "bg-ink/10 text-ink border-ink/25",
    amber: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/35",
    rose: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tones[tone], className)}
      {...props}
    />
  );
}

/* ------------------------------ Skeleton ------------------------------- */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

/* --------------------------------- Kbd --------------------------------- */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold text-muted-foreground", className)}>
      {children}
    </kbd>
  );
}

/* ----------------------------- ProgressBar ----------------------------- */
export function ProgressBar({ value, className, gradient = true }: { value: number; className?: string; gradient?: boolean }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", gradient ? "bg-[image:var(--gradient-brand)]" : "bg-primary")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ------------------------------ StatTile -------------------------------- */
export function IconChip({ children, tone = "mint" }: { children: React.ReactNode; tone?: "mint" | "azure" | "orchid" | "amber" | "rose" | "slate" }) {
  const tones = {
    mint: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    azure: "bg-orange-600/15 text-orange-700 dark:text-orange-400",
    orchid: "bg-ink/10 text-ink",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    rose: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    slate: "bg-muted text-muted-foreground",
  };
  return <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>{children}</span>;
}
