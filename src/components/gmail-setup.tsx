"use client";

/**
 * The single source of truth for "how do I get a Gmail app password?" (§9.4 / §36).
 * Inbox sync, the pitch composer and Outreach all render this, so the URL and the
 * wording can never drift apart again (the link used to point at my.google.com,
 * which does not exist).
 */
import * as React from "react";
import { KeyRound } from "lucide-react";

export const GMAIL_APP_PASSWORD_URL = "https://myaccount.google.com/apppasswords";

/** Short link shown next to every "Connect" / "Enable auto-send" button (≥24px touch target). */
export function AppPasswordLink({ className = "inline-flex min-h-6 items-center text-xs text-accent hover:underline" }: { className?: string }) {
  return (
    <a href={GMAIL_APP_PASSWORD_URL} target="_blank" rel="noreferrer" className={className}>
      Where do I get an app password?
    </a>
  );
}

/**
 * Collapsible numbered walkthrough: 2-Step Verification → app-passwords page →
 * create → copy the 16 characters → paste. Collapsed by default so it never
 * crowds the form it sits under, but one click away everywhere it appears.
 */
export function AppPasswordHelp({
  title = "How do I get a Gmail app password? (about a minute)",
  className = "",
}: {
  title?: string;
  className?: string;
}) {
  return (
    <details className={`rounded-xl border border-border bg-muted/40 px-3 py-2 ${className}`}>
      <summary className="cursor-pointer text-xs font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
        {title}
      </summary>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
        <li>
          <b className="text-foreground">Turn on 2-Step Verification</b> for the Google account you send from. Google hides app
          passwords until this is on (a passkey counts — SMS is not required).
        </li>
        <li>
          Open{" "}
          <a href={GMAIL_APP_PASSWORD_URL} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
            myaccount.google.com/apppasswords
          </a>{" "}
          in a browser where you are signed in to that Gmail address.
        </li>
        <li>
          Press <b className="text-foreground">Create</b>, name it something like <span className="font-mono">JAMS</span>, then press{" "}
          <b className="text-foreground">Create</b> again.
        </li>
        <li>
          Copy the <b className="text-foreground">16-character password</b> Google shows — it looks like{" "}
          <span className="font-mono text-foreground">abcd efgh ijkl mnop</span> and is displayed only once.
        </li>
        <li>
          Paste it into the app-password field above and save. Spaces are fine, JAMS ignores them.
        </li>
      </ol>
      <p className="mt-2 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
        <KeyRound className="mr-1 inline h-3 w-3" />
        <b className="text-foreground">Why not my normal password?</b> Gmail rejects regular passwords for apps with error{" "}
        <span className="font-mono">534</span> — only an app password works. If the page above says you have no app passwords, step 1
        is not finished yet.
      </p>
    </details>
  );
}
