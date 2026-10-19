"use client";

/**
 * The two boolean controls.
 *
 * Both are real form controls with real roles, so Space/Enter and screen readers
 * work without extra wiring, and both paint themselves from the palette instead of
 * letting the OS draw them - a raw `<input type="checkbox">` was the only
 * sharp-cornered, blue-ish thing on an otherwise warm glass page.
 */
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The on/off control. A real `role="switch"` button, not a styled checkbox, so
 * Space/Enter and screen readers behave without extra wiring.
 *
 * Always rendered with its label: a bare toggle leaves the user guessing what it
 * governs, which is exactly what made the old auto-send row on Pitch targets read
 * as decoration rather than state.
 */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("glass-chip flex items-center gap-3 rounded-xl px-3 py-2", disabled && "opacity-60", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        aria-label={typeof label === "string" ? label : undefined}
        onClick={() => onChange(!checked)}
        /* the bead is painted by .glass-switch::after, not by markup: a read-only
           state indicator (data-on) then needs nothing but the one element */
        className="glass-switch touch-slop relative h-6 w-11 shrink-0 cursor-pointer rounded-full disabled:cursor-not-allowed"
      />
      <span className="min-w-0 leading-tight">
        <span className="block text-xs font-semibold text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </div>
  );
}

/**
 * A checkbox that belongs to this design system. A raw `<input type="checkbox">`
 * paints an OS control that ignores the palette entirely - in the tracker's list
 * view it was the only blue-ish, sharp-cornered thing on a warm glass page.
 * Keyboard and screen-reader behaviour is unchanged: it is still a real input.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <span className={cn("relative inline-grid h-[18px] w-[18px] shrink-0 place-items-center", className)}>
        <input
          ref={ref}
          type="checkbox"
          className={cn(
            "peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-md border border-input bg-transparent",
            "transition-all duration-[var(--dur-2)] ease-[var(--ease-out)]",
            "hover:border-ember/60",
            "checked:border-transparent checked:bg-[image:var(--gradient-brand)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          )}
          {...props}
        />
        <Check className="pointer-events-none h-3 w-3 scale-75 text-primary-foreground opacity-0 transition-all duration-[var(--dur-2)] ease-[var(--ease-spring)] peer-checked:scale-100 peer-checked:opacity-100" />
      </span>
    );
  }
);
