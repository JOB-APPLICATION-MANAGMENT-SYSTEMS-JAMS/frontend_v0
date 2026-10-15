"use client";

/**
 * The button, and the one place its contrast rule lives.
 *
 * Variants are semantic, not decorative (CVA-style map): `outline` means "second
 * choice", `destructive` means "this cannot be undone", `azure` is the primary
 * call to action everywhere. A new screen picks a variant; it does not invent
 * colours.
 *
 * `buttonClass` is exported because navigation sometimes has to *look* like a
 * button without being one — a `<button>` nested inside an `<a>` is invalid HTML
 * and breaks middle-click.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "default" | "destructive" | "outline" | "ghost" | "link" | "secondary" | "success" | "warning" | "azure";
export type ButtonSize = "sm" | "default" | "lg" | "icon";

/* ink on ember, never white on ember: #ff9933 is bright, so the readable pairing
   is the near-black end of the ramp (8.6:1) rather than white (2.0:1). Applied to
   every filled variant so the whole app shares one contrast rule. */
const buttonVariants: Record<ButtonVariant, string> = {
  default: "sheen bg-primary text-primary-foreground hover:brightness-105 shadow-[0_12px_26px_-14px_hsl(var(--ember)/0.9)]",
  destructive: "sheen bg-destructive text-destructive-foreground hover:opacity-90",
  outline: "border border-border bg-transparent text-foreground hover:border-ember/50 hover:bg-ember/10 hover:text-ember-deep dark:hover:text-ember-soft",
  ghost: "hover:bg-muted text-foreground",
  link: "text-accent underline-offset-4 hover:underline",
  secondary: "bg-muted text-foreground hover:bg-muted/70",
  success: "sheen bg-success text-success-foreground hover:opacity-90",
  warning: "sheen bg-warning text-warning-foreground hover:opacity-90",
  /* the primary CTA everywhere: inverse pill, no hue at all */
  azure: "sheen bg-foreground text-background hover:opacity-90 shadow-[0_12px_28px_-16px_rgb(0_0_0/0.75)]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  default: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "h-9 w-9",
};

/** Same classes as <Button>, for <Link>/<a> navigation that must not wrap a <button>. */
export function buttonClass(variant: ButtonVariant = "default", size: ButtonSize = "default") {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-medium transition-all duration-[var(--dur-2)] ease-[var(--ease-out)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    // sm/icon are thumb-marginal: coarse-pointer CSS raises them to a 44px floor
    (size === "sm" || size === "icon") && "touch-target",
    buttonVariants[variant],
    buttonSizes[size]
  );
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ className, variant = "default", size = "default", ...props }, ref) {
  return <button ref={ref} className={cn(buttonClass(variant, size), className)} {...props} />;
});
