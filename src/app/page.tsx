"use client";

/**
 * Splash (§40.2 `/`): brand letter-wave (reference's PreloadAnimation reborn in our
 * palette) held ~1.2s, then route by session: authenticated → /dashboard else /auth/login.
 */
import * as React from "react";
import { useRouter } from "next/navigation";

const LETTERS = "JAMS".split("");

export default function SplashPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<"checking" | "ok" | "anon">("checking");

  React.useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    (async () => {
      let ok = false;
      try {
        const res = await fetch("/api/proxy/auth/me", { headers: { "X-Use-Auth": "true" } });
        const json = await res.json().catch(() => null);
        ok = res.ok && json?.status === "success";
      } catch {
        ok = false;
      }
      const wait = Math.max(0, 1200 - (Date.now() - start));
      setTimeout(() => {
        if (cancelled) return;
        setStatus(ok ? "ok" : "anon");
        router.replace(ok ? "/dashboard" : "/auth/login");
      }, wait);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#0f0e0d]">
      <div className="absolute inset-0 opacity-80" style={{ background: "radial-gradient(40rem 30rem at 50% 0%, hsl(22 92% 52% / .28), transparent 62%), radial-gradient(36rem 26rem at 85% 95%, hsl(14 76% 46% / .2), transparent 60%)" }} />
      <div className="relative text-center">
        <div className="flex justify-center gap-1">
          {LETTERS.map((l, i) => (
            <span
              key={`${l}-${i}`}
              className="animate-fade-in-up font-display text-6xl font-extrabold tracking-tight text-white md:text-7xl"
              style={{ animationDelay: `${0.12 + i * 0.06}s`, animationDuration: "0.6s" }}
            >
              {l}
            </span>
          ))}
        </div>
        <div className="mx-auto mt-3 h-1 w-56 rounded-full bg-[image:var(--gradient-brand)]" />
        <p className="mt-4 font-mono text-sm tracking-wide text-white/70">Job Application Management System</p>
        <p className="mt-1 font-mono text-[11px] text-white/45">{status === "checking" ? "restoring your session…" : "redirecting…"}</p>
      </div>
    </div>
  );
}
