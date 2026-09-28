"use client";

/** Shutter (spec §15.1) — pre-painted ink panels + five-bar equaliser. Transform-only, no colour show. */
const BARS = ["#ff7a1a", "#ff8f3d", "#ffa65e", "#ffc489", "#ffe0c2"];

export function PrismShutter({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[100]" aria-hidden>
      <div className="prism-top absolute inset-x-0 top-0 h-1/2" style={{ background: "linear-gradient(90deg,#17140f,#0d0c0b)" }} />
      <div className="prism-bottom absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(90deg,#221c15,#0d0c0b)" }} />
      <div className="prism-loader absolute inset-0 grid place-items-center">
        <div className="flex items-end gap-1.5">
          {BARS.map((c, i) => (
            <span key={i} className="prism-bar block h-10 w-2 rounded-full" style={{ background: c, animationDelay: `${-0.1 * i}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
