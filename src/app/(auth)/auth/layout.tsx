"use client";

/**
 * Auth layout (§40.2): split panel, form + animated brand panel.
 *
 * The poster panel follows the theme now (white in light, black in dark) and its
 * only colour is the accent — two ember radials over the page background. The
 * floating chips are real glass, so they pick up whatever is behind them.
 */
import * as React from "react";
import Link from "next/link";
import Image from "next/image";

const CHIPS = ["Human-in-the-loop", "Streaks & goals", "Free job sources", "Works local & online"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        {/* two ember clouds, drifting · the only colour on the panel */}
        <div className="mesh-bg abs" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link href="/" className="press flex w-fit items-center gap-2.5">
            <Image src="/jams-logo.png" alt="" width={403} height={322} className="h-9 w-auto drop-shadow-[0_6px_16px_hsl(30_100%_60%/0.4)]" priority />
            <span className="font-display text-xl font-extrabold tracking-tight">JAMS</span>
          </Link>

          <div>
            <p className="eyebrow">Job Application Management System</p>
            <h2 className="font-display mt-3 max-w-md text-4xl font-extrabold leading-[1.08] tracking-tight">
              Apply faster.
              <br />
              <span className="text-gradient-brand">Track everything.</span>
              <br />
              Stay consistent.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Discovery with explainable scoring, a pipeline that never forgets, cold email you still send yourself, and an honest funnel, applied, replied,
              ghosted, rejected, interviewed, offered.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[11px]">
              {CHIPS.map((b, i) => (
                <span
                  key={b}
                  className="glass-tab animate-focus-in rounded-full px-3 py-1.5 font-medium text-foreground"
                  style={{ animationDelay: `${120 + i * 70}ms` }}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Nothing is ever auto-submitted or auto-sent. You press the buttons.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="route-fade w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
