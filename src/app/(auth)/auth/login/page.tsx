"use client";

/** Login (§40.2), rich-403 branches (verify / suspended), redirect param preserved (§4.2). */
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { LogIn, MailCheck, ShieldAlert } from "lucide-react";
import { appFetch, APIRequestError } from "@/lib/api";
import { setSession, type AuthSessionResponse } from "@/lib/api/session";
import { Button, Input, Label, PasswordInput } from "@/components/ui/base";
import { InlineBanner } from "@/components/ui/feedback";
import { toast } from "@/hooks/use-toast";

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
  const [verifyToken, setVerifyToken] = React.useState("");

  const login = useMutation({
    mutationFn: () => appFetch<AuthSessionResponse>("/auth/login", { method: "POST", body: { email, password }, _auth: false }),
    // the page renders its own banners (verify / suspended) and its own toast — stay quiet centrally
    meta: { silentError: true },
    onSuccess: async (data) => {
      await setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      router.replace(redirect);
      router.refresh();
    },
    onError: (err) => {
      if (err instanceof APIRequestError) {
        if (err.code === "REQUIRES_VERIFICATION") return setNeedsVerify(true);
        if (err.code === "SUSPENDED") return setSuspended(true);
        return toast(err.message, "error");
      }
      toast("Network error, is the backend running?", "error");
    },
  });

  const verify = useMutation({
    mutationFn: () => appFetch<unknown>("/auth/verify-email", { method: "POST", body: { token: verifyToken }, _auth: false }),
    meta: { silentError: true },
    onSuccess: () => {
      toast("Email verified, sign in now", "success");
      setNeedsVerify(false);
      setVerifyToken("");
    },
    onError: (err) => toast(err instanceof APIRequestError ? err.message : "Verification failed", "error"),
  });

  const resend = useMutation({
    mutationFn: () => appFetch<{ sent: boolean; verification_token?: string }>("/auth/resend-verification", { method: "POST", body: { email }, _auth: false }),
    meta: { silentError: true },
    onSuccess: (data) => {
      // local mode: the API returns the fresh token, so pre-fill it for a one-click verify
      if (data?.verification_token) setVerifyToken(data.verification_token);
      toast(
        data?.verification_token ? "New token ready — paste it below" : "New verification link sent, check your inbox",
        "success"
      );
    },
    onError: () => toast("Couldn’t resend, try again", "error"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your job application management system.</p>
      </div>

      {needsVerify && (
        <InlineBanner tone="warn" title="Email not verified yet">
          <p className="mb-2">
            Enter the verification token for <span className="font-mono">{email}</span>. It arrives in the verification
            email — or, when this deployment has no inbox, the API hands it straight back:{" "}
            <button className="underline" onClick={() => resend.mutate()} disabled={resend.isPending}>
              {resend.isPending ? "sending…" : "get a new token"}
            </button>{" "}
            then paste it below.
          </p>
          <div className="flex gap-2">
            <Input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} placeholder="paste verification token" aria-label="Verification token" />
            <Button variant="azure" onClick={() => verify.mutate()} disabled={!verifyToken || verify.isPending}>
              <MailCheck className="h-4 w-4" /> Verify
            </Button>
          </div>
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
