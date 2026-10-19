"use client";

/**
 * Shutter (spec §15.1) - pre-painted panels + a five-bar equaliser.
 * Transform-only, no colour show. The panels are the *background* colour of the
 * theme they are covering, so the wipe reads as the page closing rather than a
 * black flash in light mode.
 */
const BARS = ["hsl(30 100% 48%)", "hsl(30 100% 56%)", "hsl(30 100% 62%)", "hsl(30 100% 70%)", "hsl(30 100% 80%)"];

export function PrismShutter({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[100]" aria-hidden>
      <div className="prism-top absolute inset-x-0 top-0 h-1/2 border-b border-[var(--glass-edge)]" style={{ background: "linear-gradient(180deg, hsl(var(--background)), hsl(var(--muted)))" }} />
      <div className="prism-bottom absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(180deg, hsl(var(--muted)), hsl(var(--background)))" }} />
      {/* the seam lights up: a single ember hairline where the two panels meet */}
      <div className="prism-loader absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[image:var(--gradient-brand)] opacity-70" />
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
