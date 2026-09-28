"use client";

/** Login (§40.2) — rich-403 branches (verify / suspended), redirect param preserved (§4.2). */
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { LogIn, ShieldAlert } from "lucide-react";
import { appFetch, APIRequestError } from "@/lib/api";
import { Button, Input, Label, PasswordInput } from "@/components/ui/base";
import { InlineBanner } from "@/components/ui/feedback";
import { toast } from "@/hooks/use-toast";

async function setSession(data: any) {
  await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token, role: "owner" }),
  });
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginPageInner />
    </React.Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [needsVerify, setNeedsVerify] = React.useState(false);
  const [suspended, setSuspended] = React.useState(false);

  const login = useMutation({
    mutationFn: () => appFetch<any>("/auth/login", { method: "POST", body: { email, password }, _auth: false }),
    onSuccess: async (data) => {
      await setSession(data);
      router.replace(redirect);
      router.refresh();
    },
    onError: (err) => {
      if (err instanceof APIRequestError) {
        if (err.code === "REQUIRES_VERIFICATION") return setNeedsVerify(true);
        if (err.code === "SUSPENDED") return setSuspended(true);
        return toast(err.message, "error");
      }
      toast("Network error — is the backend running?", "error");
    },
  });

  const resend = useMutation({
    mutationFn: () => appFetch<any>("/auth/resend-verification", { method: "POST", body: { email }, _auth: false }),
    onSuccess: () => toast("New verification link sent (local mode: check the API console)", "success"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your job hunt operating system.</p>
      </div>

      {needsVerify && (
        <InlineBanner tone="warn" title="Email not verified yet">
          We sent a link to <span className="font-mono">{email}</span>. Local mode prints the link in the API console — or{" "}
          <button className="underline" onClick={() => resend.mutate()}>
            resend it
          </button>
          .
        </InlineBanner>
      )}
      {suspended && (
        <InlineBanner tone="danger" title="Account suspended">
          Contact support or reset your password to continue.
        </InlineBanner>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate();
        }}
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <Button type="submit" className="w-full" disabled={login.isPending}>
          <LogIn className="h-4 w-4" />
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/auth/signup" className="font-semibold text-accent hover:underline">
          Create one
        </Link>
      </p>
      {suspended && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" /> Suspended sessions can’t be restored from this device.
        </p>
      )}
    </div>
  );
}
