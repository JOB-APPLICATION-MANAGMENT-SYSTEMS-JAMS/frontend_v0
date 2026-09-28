"use client";

/**
 * Query client with the reference's invalidation-by-meta pattern (§11.1):
 * mutations declare `meta: { invalidates: [...] }`, the global MutationCache matches
 * and invalidates — write the intent once, every dependent view refreshes.
 */
import { QueryClient, MutationCache } from "@tanstack/react-query";
import { handleMutationError } from "@/lib/api/error-utils";

let client: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (client) return client;
  client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false, throwOnError: false },
      mutations: { retry: 0 },
    },
    mutationCache: new MutationCache({
      onSuccess: (_data, _vars, _ctx, mutation) => {
        const keys = (mutation.meta as any)?.invalidates as string[][] | undefined;
        if (!keys?.length) return;
        for (const key of keys) client!.invalidateQueries({ queryKey: key });
      },
      onError: (error, _vars, _ctx, mutation) => {
        const fallback = (mutation.meta as any)?.errorFallback as string | undefined;
        if ((mutation.meta as any)?.silentError) return;
        // toast surfaced centrally: any mounted <ToastHost/> listens for this event (§9.2)
        if (typeof window !== "undefined") {
          const ev = new CustomEvent("jams-toast", { detail: { message: handleMutationError(error, fallback) } });
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
  applicationList: (params: any) => ["applications", "list", params] as const,
  application: (id: string) => ["applications", "detail", id] as const,
  jobs: () => ["jobs"] as const,
  jobList: (params: any) => ["jobs", "search", params] as const,
  job: (id: string) => ["jobs", "detail", id] as const,
  analytics: () => ["analytics"] as const,
  summary: (period: string) => ["analytics", "summary", period] as const,
  streaks: () => ["streaks"] as const,
  today: () => ["streaks", "today"] as const,
  cvs: () => ["cvs"] as const,
  cv: (id: string) => ["cvs", "detail", id] as const,
  templates: (filter?: any) => ["templates", filter ?? {}] as const,
  outreach: (filter?: any) => ["outreach", filter ?? {}] as const,
  companies: (filter?: any) => ["companies", filter ?? {}] as const,
  company: (id: string) => ["companies", "detail", id] as const,
  threads: () => ["inbox", "threads"] as const,
  mailbox: () => ["inbox", "mailbox"] as const,
  searches: () => ["searches"] as const,
  badges: () => ["streaks", "badges"] as const,
};
