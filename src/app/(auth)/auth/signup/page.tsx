"use client";

/** Signup + email verification hand-off (local mode prints the token server-side). */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { UserPlus, MailCheck } from "lucide-react";
import { appFetch, APIRequestError } from "@/lib/api";
import { Button, Input, Label } from "@/components/ui/base";
import { InlineBanner } from "@/components/ui/feedback";
import { toast } from "@/hooks/use-toast";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = React.useState({ email: "", password: "", confirm: "" });
  const [done, setDone] = React.useState(false);

  const signup = useMutation({
    mutationFn: () =>
      appFetch<any>("/auth/register", {
        method: "POST",
        body: { email: form.email, password: form.password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        _auth: false,
      }),
    onSuccess: async (data) => {
      // store session now; backend flags requires_verification until verified
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token }),
      });
      setDone(true);
    },
    onError: (err) => {
      if (err instanceof APIRequestError) {
        const fieldMsg = Object.values(err.fieldErrors ?? {})[0];
        return toast(fieldMsg ?? err.message, "error");
      }
      toast("Network error", "error");
    },
  });

  if (done) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Check your inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">We sent a verification link to {form.email}.</p>
        </div>
        <InlineBanner tone="success" title="Local mode">
          No SMTP here — the API console prints your verification link (like MailPit). Paste the token below or open it directly.
        </InlineBanner>
        <VerifyBox onDone={() => router.replace("/onboarding")} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">One profile, many CVs, zero forgotten applications.</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.password !== form.confirm) return toast("Passwords don’t match", "error");
          signup.mutate();
        }}
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </div>
        <Button type="submit" className="w-full" disabled={signup.isPending}>
          <UserPlus className="h-4 w-4" />
          {signup.isPending ? "Creating…" : "Create account"}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/auth/login" className="font-semibold text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function VerifyBox({ onDone }: { onDone: () => void }) {
  const [token, setToken] = React.useState("");
  const verify = useMutation({
    mutationFn: () => appFetch<any>("/auth/verify-email", { method: "POST", body: { token }, _auth: false }),
    onSuccess: () => {
      toast("Email verified — welcome aboard", "success");
      onDone();
    },
    onError: (err) => toast(err instanceof APIRequestError ? err.message : "Verification failed", "error"),
  });
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="paste verification token" />
        <Button onClick={() => verify.mutate()} disabled={!token || verify.isPending} variant="azure">
          <MailCheck className="h-4 w-4" /> Verify
        </Button>
      </div>
      <Link href="/onboarding" className="block text-xs text-muted-foreground hover:underline">
        Skip for now →
      </Link>
    </div>
  );
}
