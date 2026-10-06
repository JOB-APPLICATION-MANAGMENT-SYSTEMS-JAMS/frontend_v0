"use client";

/**
 * Query client with the reference's invalidation-by-meta pattern (§11.1):
 * mutations declare `meta: { invalidates: [...] }`, the global MutationCache matches
 * and invalidates, write the intent once, every dependent view refreshes.
 */
import { QueryClient, MutationCache } from "@tanstack/react-query";
import { handleMutationError } from "@/lib/api/error-utils";

let client: QueryClient | null = null;

/** Meta every mutation may declare (§11.1 / §9.2). Typed so the cache never needs `any`. */
type MutationMeta = {
  /** query keys to invalidate on success */
  invalidates?: string[][];
  /** message used when the error carries none of its own */
  errorFallback?: string;
  /** the page renders its own inline error UI — stay quiet in the toast host */
  silentError?: boolean;
};

export function getQueryClient(): QueryClient {
  if (client) return client;
  client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false, throwOnError: false },
      mutations: { retry: 0 },
    },
    mutationCache: new MutationCache({
      onSuccess: (_data, _vars, _ctx, mutation) => {
        const meta = mutation.meta as MutationMeta | undefined;
        if (!meta?.invalidates?.length) return;
        for (const key of meta.invalidates) client!.invalidateQueries({ queryKey: key });
      },
      onError: (error, _vars, _ctx, mutation) => {
        const meta = mutation.meta as MutationMeta | undefined;
        if (meta?.silentError) return;
        // toast surfaced centrally: any mounted <ToastHost/> listens for this event (§9.2).
        // kind is explicit: a failed mutation is an error even when its message reads neutral.
        if (typeof window !== "undefined") {
          const ev = new CustomEvent("jams-toast", {
            detail: { message: handleMutationError(error, meta?.errorFallback), kind: "error" },
          });
          window.dispatchEvent(ev);
        }
      },
    }),
  });
  return client;
}

export const qk = {
  auth: () => ["auth"] as const,
  me: () => ["auth", "me"] as const,
  profile: () => ["profile"] as const,
  completeness: () => ["profile", "completeness"] as const,
  applications: () => ["applications"] as const,
  applicationList: (params: unknown) => ["applications", "list", params] as const,
  application: (id: string) => ["applications", "detail", id] as const,
  jobs: () => ["jobs"] as const,
  jobList: (params: unknown) => ["jobs", "search", params] as const,
  job: (id: string) => ["jobs", "detail", id] as const,
  analytics: () => ["analytics"] as const,
  summary: (period: string) => ["analytics", "summary", period] as const,
  streaks: () => ["streaks"] as const,
  today: () => ["streaks", "today"] as const,
  cvs: () => ["cvs"] as const,
  cv: (id: string) => ["cvs", "detail", id] as const,
  templates: (filter?: unknown) => ["templates", filter ?? {}] as const,
  outreach: (filter?: unknown) => ["outreach", filter ?? {}] as const,
  companies: (filter?: unknown) => ["companies", filter ?? {}] as const,
  company: (id: string) => ["companies", "detail", id] as const,
  threads: () => ["inbox", "threads"] as const,
  mailbox: () => ["inbox", "mailbox"] as const,
  searches: () => ["searches"] as const,
  badges: () => ["streaks", "badges"] as const,
};
