"use client";

/** Signup: create the account, verify it invisibly with the token the API returns, straight into the app. */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { appFetch, APIRequestError } from "@/lib/api";
import { setSession, type AuthSessionResponse } from "@/lib/api/session";
import { Button, Input, Label, PasswordInput } from "@/components/ui/base";
import { toast } from "@/hooks/use-toast";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = React.useState({ firstName: "", lastName: "", email: "", password: "", confirm: "" });

  const signup = useMutation({
    mutationFn: async () => {
      const data = await appFetch<AuthSessionResponse>("/auth/register", {
        method: "POST",
        body: { first_name: form.firstName.trim(), last_name: form.lastName.trim(), email: form.email, password: form.password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        _auth: false,
      });
      // keep the session the API just handed us
      await setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      // no inbox step: the API returns the verification token, so verify right away and move on
      if (data.verification_token) {
        try {
          await appFetch("/auth/verify-email", { method: "POST", body: { token: data.verification_token }, _auth: false });
        } catch {
          /* already verified, or a legacy account; login will tell us if anything is off */
        }
      }
      return data;
    },
    onSuccess: () => {
      toast("Account created. Welcome to JAMS!", "success");
      router.replace("/dashboard");
    },
    // field-level messages are toasted below; the central cache would only repeat them
    meta: { silentError: true },
    onError: (err) => {
      if (err instanceof APIRequestError) {
        const fieldMsg = Object.values(err.fieldErrors ?? {})[0];
        return toast(fieldMsg ?? err.message, "error");
      }
      toast("Network error", "error");
    },
  });

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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="first_name">First name</Label>
            <Input id="first_name" autoComplete="given-name" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Ada" />
          </div>
          <div>
            <Label htmlFor="last_name">Last name</Label>
            <Input id="last_name" autoComplete="family-name" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Lovelace" />
          </div>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput id="confirm" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
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
