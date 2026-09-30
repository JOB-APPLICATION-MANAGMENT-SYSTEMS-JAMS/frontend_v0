import Link from "next/link";

/** 404 (§10 error states), branded, with the routes that get you back on track. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-7xl font-extrabold text-gradient-brand">404</p>
      <h1 className="font-display mt-3 text-2xl font-extrabold">This route ghosted you</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Nothing here, but your hunt is one keystroke away. Press <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd>{" "}
        from the dashboard, or pick a destination.
      </p>
      <nav className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/dashboard" className="rounded-full bg-[image:var(--gradient-brand)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-900/25 transition hover:opacity-90">
          Dashboard
        </Link>
        <Link href="/discover" className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted">
          Discover
        </Link>
        <Link href="/tracker" className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted">
          Tracker
        </Link>
      </nav>
    </div>
  );
}
