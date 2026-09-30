"use client";

/** Login (§40.2), rich-403 branches (verify / suspended), redirect param preserved (§4.2). */
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { LogIn, MailCheck, ShieldAlert } from "lucide-react";
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
  const [verifyToken, setVerifyToken] = React.useState("");

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
      toast("Network error, is the backend running?", "error");
    },
  });

  const verify = useMutation({
    mutationFn: () => appFetch<any>("/auth/verify-email", { method: "POST", body: { token: verifyToken }, _auth: false }),
    onSuccess: () => {
      toast("Email verified, sign in now", "success");
      setNeedsVerify(false);
      setVerifyToken("");
    },
    onError: (err) => toast(err instanceof APIRequestError ? err.message : "Verification failed", "error"),
  });

  const resend = useMutation({
    mutationFn: () => appFetch<any>("/auth/resend-verification", { method: "POST", body: { email }, _auth: false }),
    onSuccess: (data: any) => {
      // no SMTP, the API hands the fresh token straight back, so pre-fill it
      if (data?.verification_token) setVerifyToken(data.verification_token);
      toast("New verification code sent", "success");
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
            Enter the verification code for <span className="font-mono">{email}</span>. This deployment sends no email,{" "}
            <button className="underline" onClick={() => resend.mutate()} disabled={resend.isPending}>
              {resend.isPending ? "sending…" : "get a new code"}
            </button>{" "}
            returns it straight to the API.
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
