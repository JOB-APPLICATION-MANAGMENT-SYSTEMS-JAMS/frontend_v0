"use client";

/**
 * Text-entry primitives: the surface (`glass-input`), the label shape, and the one
 * composite field.
 *
 * All of them are the same height and the same radius on purpose - a row that mixes
 * an `Input`, a `Select` and a `Button` should look like one row. Anything that
 * needs a different shape is a different control, not an override.
 */
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

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

/** Password field with a show/hide eye toggle, the toggle is a real button so it
 *  stays keyboard reachable and screen-reader announced, never an onClick on the input. */
export function PasswordInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

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
