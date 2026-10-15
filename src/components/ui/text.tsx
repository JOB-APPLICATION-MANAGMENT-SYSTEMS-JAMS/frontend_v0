"use client";

/**
 * The three text shapes that were being re-typed as class strings all over the
 * product. They are deliberately tiny: this is not a typography system, it is the
 * vocabulary for "the small caps label above a section", "the quiet line under a
 * figure" and "a number that must not jitter".
 *
 * Anything longer than a line belongs in the component that owns the content.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

/** The mono small-caps label above a section — one per region, never decorative. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}

/** The quiet explanatory line: 11px, muted, relaxed leading, capped to a readable measure. */
export function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[11px] leading-relaxed text-muted-foreground", className)}>{children}</p>;
}

/** A figure that ticks. Tabular figures so the width does not change as it counts —
 *  without this, a rolling number makes everything beside it shift. */
export function Num({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("tnum", className)}>{children}</span>;
}
