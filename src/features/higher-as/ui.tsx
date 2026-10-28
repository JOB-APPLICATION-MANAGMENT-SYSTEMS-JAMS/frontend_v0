"use client";

/**
 * The vocabulary of evidence.
 *
 * Higher As has to keep four kinds of claim visibly apart: what a professional
 * says about themselves, what a customer wrote, what JAMS actually checked, and
 * a machine-written line built from the post. These components make that
 * distinction impossible to miss in the UI.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Clock, Copy, Globe, Link2, MessageCircle, Phone, ShieldCheck, Star, XCircle } from "lucide-react";
import { appFetch } from "@/lib/api";
import { Badge, Button } from "@/components/ui/base";
import { Modal } from "@/components/ui/modal";
import { cn, fmt } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { CredentialStatus, ProContact, Rating } from "./types";

export function Stars({ avg, className }: { avg: number | null; className?: string }) {
  const rounded = avg == null ? 0 : Math.round(avg);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={avg == null ? "No reviews yet" : `${avg} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("h-3.5 w-3.5", i <= rounded ? "fill-ember text-ember" : "text-border")}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}

export function RatingSummary({ rating, compact = false }: { rating: Rating; compact?: boolean }) {
  if (!rating.count) {
    return <span className="text-[11px] text-muted-foreground">No reviews yet</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Stars avg={rating.avg} />
      <span className="tnum text-xs font-bold">{rating.avg?.toFixed(1)}</span>
      <span className="text-[11px] text-muted-foreground">
        ({rating.count} review{rating.count === 1 ? "" : "s"}
        {rating.verified > 0 && `, ${rating.verified} verified`})
      </span>
      {!compact && rating.verified === 0 && (
        <span className="text-[11px] text-muted-foreground">· none tied to a confirmed job</span>
      )}
    </span>
  );
}

export function RatingBlock({ rating }: { rating: Rating }) {
  const max = Math.max(1, ...rating.distribution.map((d) => d.count));
  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="text-center sm:text-left">
        <p className="tnum font-display text-4xl font-extrabold leading-none">{rating.avg?.toFixed(1) ?? "-"}</p>
        <Stars avg={rating.avg} className="mt-1.5" />
        <p className="mt-1 text-[11px] text-muted-foreground">{rating.count} review{rating.count === 1 ? "" : "s"}</p>
        <p className="text-[11px] text-muted-foreground">{rating.verified} with a confirmed job</p>
      </div>
      <div className="space-y-1">
        {rating.distribution.map((d) => (
          <div key={d.star} className="flex items-center gap-2">
            <span className="tnum w-3 shrink-0 text-[11px] text-muted-foreground">{d.star}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-ember/70" style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className="tnum w-5 shrink-0 text-right text-[11px] text-muted-foreground">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_META: Record<CredentialStatus, { label: string; tone: "mint" | "amber" | "neutral"; icon: React.ComponentType<{ className?: string }>; help: string }> = {
  verified: { label: "Verified", tone: "mint", icon: ShieldCheck, help: "A JAMS reviewer checked the submitted document." },
  pending: { label: "Pending review", tone: "amber", icon: Clock, help: "Submitted, waiting for a reviewer. It is not evidence yet." },
  rejected: { label: "Rejected", tone: "neutral", icon: XCircle, help: "A reviewer could not confirm this document." },
  expired: { label: "Expired", tone: "neutral", icon: AlertTriangle, help: "It was verified, but the expiry date has passed." },
};

export function CredentialStatusBadge({ status, className }: { status: CredentialStatus; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone} className={cn("gap-1", className)} title={meta.help}>
      <Icon className="h-3 w-3" /> {meta.label}
    </Badge>
  );
}

/**
 * The sentence that has to sit next to every badge. A verified document says one
 * narrow thing; it is not a character reference, a guarantee, or a safety audit.
 */
export function VerificationNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] leading-relaxed text-muted-foreground", className)}>
      <ShieldCheck className="mr-1 inline h-3 w-3 align-[-2px]" />
      Verified means a reviewer saw a matching document on the date shown. It is not a guarantee of the work, the price, or the person.
    </p>
  );
}

export function AutoSummary({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-muted/50 px-2.5 py-2", className)}>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Auto summary
        <span className="font-normal normal-case tracking-normal">· built from this post only</span>
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

export function ShareButton({ path, label = "Share", className }: { path: string; label?: string; className?: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast("Link copied", "success");
    } catch {
      toast("Could not copy the link", "error");
    }
  };
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={copy}
      className={className}
      title="Copy a public link to this profile"
      aria-label={label || "Copy a public link to this profile"}
    >
      <Link2 className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}

const CURRENCY: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", KES: "KSh", GHS: "₵" };

export function dayRate(min: number | null, max: number | null, currency: string) {
  if (min == null && max == null) return null;
  const sym = CURRENCY[currency] ?? `${currency} `;
  if (min != null && max != null && min !== max) return `${sym}${fmt.n(min)} - ${sym}${fmt.n(max)} / day`;
  return `${sym}${fmt.n((min ?? max) as number)} / day`;
}

export function ContactDialog({
  proId,
  name,
  open,
  onClose,
}: {
  proId: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const contact = useQuery<ProContact>({
    queryKey: ["higher-as", "contact", proId],
    queryFn: () => appFetch(`/higher-as/pros/${proId}/contact`, { _auth: true }),
    enabled: open,
    staleTime: 60_000,
  });

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied`, "success");
    } catch {
      toast("Could not copy", "error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} label={`Contact ${name}`} className="max-w-md">
      <p className="font-display text-lg font-bold">Contact {name}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Shared by the professional, not by JAMS. Agree the scope, price and timing before any work starts.
      </p>

      {contact.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading contact details…</p>
      ) : contact.error ? (
        <p className="mt-4 text-sm text-muted-foreground">Contact details could not be loaded. Try again in a moment.</p>
      ) : !contact.data?.phone && !contact.data?.whatsapp && !contact.data?.website ? (
        <p className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          This professional has not shared a contact number yet. Save the profile and check back, or open their work to see how they prefer to be reached.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {contact.data?.phone && (
            <ContactRow icon={<Phone className="h-4 w-4" />} label="Phone" value={contact.data.phone} onCopy={() => copy(contact.data!.phone!, "Phone")} href={`tel:${contact.data.phone}`} />
          )}
          {contact.data?.whatsapp && (
            <ContactRow
              icon={<MessageCircle className="h-4 w-4" />}
              label="WhatsApp"
              value={contact.data.whatsapp}
              onCopy={() => copy(contact.data!.whatsapp!, "WhatsApp")}
              href={`https://wa.me/${contact.data.whatsapp.replace(/[^\d]/g, "")}`}
            />
          )}
          {contact.data?.website && (
            <ContactRow icon={<Globe className="h-4 w-4" />} label="Website" value={contact.data.website} onCopy={() => copy(contact.data!.website!, "Website")} href={contact.data.website} />
          )}
        </ul>
      )}

      <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">{contact.data?.note ?? ""}</p>
    </Modal>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  onCopy: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="block truncate text-sm font-medium hover:text-accent">
          {value}
        </a>
      </span>
      <button type="button" onClick={onCopy} aria-label={`Copy ${label}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

export function VerifiedJobTag() {
  return (
    <Badge tone="mint" className="gap-1" title="This customer recorded the job and the professional confirmed it was completed.">
      <Check className="h-3 w-3" /> confirmed job
    </Badge>
  );
}

/** Credential dates need the year: “expires Feb 14” is not a fact anyone can check. */
export const dateOrDash = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "-";
