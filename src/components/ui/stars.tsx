"use client";

/**
 * The rating control, used by the people directory (leave a review) and Resume
 * Studio (read the reviews). One component so a 4-star average looks identical in
 * both places, and so the interactive version stays a real radiogroup.
 */
import * as React from "react";
import { Star } from "lucide-react";

export function Stars({
  value,
  onChange,
  size = 14,
  label = "Rating",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  label?: string;
}) {
  if (!onChange) {
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            style={{ width: size, height: size }}
            className={n <= Math.round(value) ? "fill-ember text-ember" : "text-border"}
            aria-hidden
          />
        ))}
      </span>
    );
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className="touch-slop grid h-7 w-7 place-items-center rounded-lg transition-transform hover:scale-110"
        >
          <Star style={{ width: size, height: size }} className={n <= value ? "fill-ember text-ember" : "text-border"} />
        </button>
      ))}
    </div>
  );
}
