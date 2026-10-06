"use client";

/**
 * Odometer (spec §5/#5), digit columns roll expo-out over 600ms, changed digits only,
 * transform/opacity only. Reduced-motion → instant final value (layer 2 gate).
 */
import * as React from "react";

export function Odometer({ value, duration = 600, className }: { value: number; duration?: number; className?: string }) {
  const [shown, setShown] = React.useState(value);
  const prev = React.useRef(value);

  React.useEffect(() => {
    if (prev.current === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // jump to the final value on the next frame: no roll-out, and the setState
      // stays async so it never triggers a cascading render from this effect
      const jump = requestAnimationFrame(() => {
        setShown(value);
        prev.current = value;
      });
      return () => cancelAnimationFrame(jump);
    }
    const t0 = performance.now();
    const from = prev.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3); // expo-out
      setShown(Math.round(from + (value - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{shown.toLocaleString()}</span>;
}
