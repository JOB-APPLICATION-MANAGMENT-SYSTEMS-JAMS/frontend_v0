/**
 * fireConfetti, three-burst choreography with brand colours (§41.5), dynamically
 * imported so it never burdens initial load. Called on: goal hit · offer · victory.
 */
const BRAND = ["#ff7a1a", "#ffb020", "#ffe9d2", "#e2571f"];

export async function fireConfetti(opts: { slowmo?: boolean } = {}) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // layer 1 gate
  const confetti = (await import("canvas-confetti")).default;
  const base = { colors: BRAND, zIndex: 9999, disableForReducedMotion: true };
  confetti({ ...base, particleCount: 120, spread: 70, origin: { y: 0.7 } });
  setTimeout(() => confetti({ ...base, particleCount: 60, spread: 100, scalar: 1.2, origin: { y: 0.7 } }), 180);
  setTimeout(() => confetti({ ...base, particleCount: 30, spread: 130, startVelocity: 45, scalar: 0.75, origin: { y: 0.7 } }), 360);
  if (opts.slowmo) {
    setTimeout(() => confetti({ ...base, particleCount: 200, spread: 160, decay: 0.92, scalar: 1.4, origin: { y: 0.5 } }), 700);
    setTimeout(() => confetti({ ...base, particleCount: 160, spread: 180, decay: 0.9, scalar: 0.9, origin: { y: 0.3 } }), 1200);
  }
}
