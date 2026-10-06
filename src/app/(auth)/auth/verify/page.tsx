"use client";

/**
 * Email verification landing page (§4.3): online mode emails `${WEB_ORIGIN}/auth/verify?token=…`,
 * this page exchanges it for a verified account. Local mode never links here (the signup
 * flow auto-verifies with the token the API hands back), but a pasted token works too.
 */
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2, MailCheck, ShieldAlert } from "lucide-react";
import { appFetch, APIRequestError } from "@/lib/api";
import { Button } from "@/components/ui/base";
import { InlineBanner } from "@/components/ui/feedback";
import { toast } from "@/hooks/use-toast";

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyEmailInner />
    </React.Suspense>
  );
}

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const verify = useMutation({
    mutationFn: () => appFetch<{ email: string }>("/auth/verify-email", { method: "POST", body: { token }, _auth: false }),
    // this page renders its own state machine — a toast would duplicate it
    meta: { silentError: true },
    onSuccess: () => {
      setDone(true);
      toast("Email verified — you can sign in now", "success");
    },
    onError: (err) => {
      setError(
        err instanceof APIRequestError
          ? err.message
          : "We couldn't reach the server to verify this link. Check your connection and try again."
      );
    },
  });

  const attempted = React.useRef(false);
  React.useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    verify.mutate();
  }, [token, verify]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Email verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirming this address finishes setting up your account.</p>
      </div>

      {!token && (
        <InlineBanner tone="danger" title="This link is missing its token">
          <p>
            Open the link exactly as it arrived in your email, or{" "}
            <Link href="/auth/login" className="font-semibold text-accent underline">
              sign in
            </Link>{" "}
            and request a fresh verification email.
          </p>
        </InlineBanner>
      )}

      {token && verify.isPending && (
        <InlineBanner tone="info" title="Verifying…">
          <p className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your verification token.
          </p>
        </InlineBanner>
      )}

      {token && done && (
        <InlineBanner tone="success" title="Email verified">
          <p className="mb-3">Your address is confirmed — everything is ready.</p>
          <Link href="/auth/login">
            <Button variant="azure" size="sm">
              <MailCheck className="h-4 w-4" /> Continue to sign in
            </Button>
          </Link>
        </InlineBanner>
      )}

      {token && error && !verify.isPending && (
        <InlineBanner tone="danger" title="That link didn't work">
          <p className="mb-3 flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {error} Verification links stop working as soon as a newer one is requested — ask for a new email and use the
              latest link.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => verify.mutate()} disabled={verify.isPending}>
              {verify.isPending ? "Trying again…" : "Try again"}
            </Button>
            <Link href="/auth/login">
              <Button size="sm" variant="ghost">
                Back to sign in
              </Button>
            </Link>
          </div>
        </InlineBanner>
      )}
    </div>
  );
}
