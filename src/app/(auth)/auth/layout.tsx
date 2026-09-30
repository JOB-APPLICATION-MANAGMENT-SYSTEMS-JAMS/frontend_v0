"use client";

/** Auth layout (§40.2): split panel, form + animated brand panel. */
import * as React from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0e0d0c, #17140f 45%, #241a12)" }} />
        <div className="absolute inset-0 opacity-80" style={{ background: "radial-gradient(30rem 24rem at 15% 20%, hsl(22 92% 52% / .3), transparent 60%), radial-gradient(28rem 22rem at 85% 85%, hsl(14 76% 46% / .26), transparent 60%), radial-gradient(24rem 20rem at 70% 15%, hsl(40 90% 55% / .18), transparent 60%)" }} />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Link href="/" className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-[image:var(--gradient-brand)]" />
            <span className="font-display text-xl font-extrabold">JAMS</span>
          </Link>
          <div>
            <h2 className="font-display max-w-md text-4xl font-extrabold leading-tight">
              Apply faster.
              <br />
              <span className="text-gradient-brand">Track everything.</span>
              <br />
              Stay consistent.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
              Discovery with explainable scoring, a pipeline that never forgets, cold email you still send yourself, and an honest funnel, applied, replied,
              ghosted, rejected, interviewed, offered.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[11px]">
              {["Human-in-the-loop", "Streaks & goals", "Free job sources", "Works local & online"].map((b) => (
                <span key={b} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-md">
                  {b}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/50">Nothing is ever auto-submitted or auto-sent. You press the buttons.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm route-fade">{children}</div>
      </div>
    </div>
  );
}
