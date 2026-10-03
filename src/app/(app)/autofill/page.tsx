"use client";

/**
 * Autofill control centre (§35 / §19.3): the single editable home for what the
 * extension fills — application answers, pre-written replies for recurring exam
 * questions, and label aliases — plus the guardrails in plain words.
 */
import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import { Badge, Button, Card, Input, Label, Skeleton } from "@/components/ui/base";
import { ErrorState, InlineBanner } from "@/components/ui/feedback";
import { toast } from "@/hooks/use-toast";

type Profile = { identity: any; aliases: any; version: number };
type Schema = {
  fields: { key: string; aliases: string[]; value: string | null; visible: boolean }[];
  guardrails: { never_fill: string[] };
  confidence_policy: { auto_fill: number; fill_flagged: number };
};
type Answer = { match: string; answer: string };

/** The exact questions job forms keep asking — each maps to one identity key. */
const ANSWER_KEYS = [
  ["first_name", "First name"],
  ["middle_name", "Middle name"],
  ["last_name", "Last name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["location", "Location"],
  ["work_authorization", "Legally authorized to work (Yes/No)"],
  ["sponsorship", "Requires visa sponsorship (Yes/No)"],
  ["relocation", "Office / relocation answer"],
  ["graduation_year", "Graduation year"],
  ["heard_about", "How did you hear about this job?"],
] as const;

const LINK_KEYS = [
  ["linkedin", "LinkedIn URL"],
  ["github", "GitHub URL"],
  ["website", "Website / portfolio"],
] as const;

export default function AutofillPage() {
  const profile = useQuery<Profile>({ queryKey: qk.profile(), queryFn: () => appFetch("/profile", { _auth: true }) });
  const schema = useQuery<Schema>({
    queryKey: ["autofill", "schema"],
    queryFn: () => appFetch("/autofill/schema", { _auth: true }),
    staleTime: 60_000,
  });

  const [ready, setReady] = React.useState(false);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [links, setLinks] = React.useState<Record<string, string>>({});
  const [custom, setCustom] = React.useState<Answer[]>([]);
  const [aliasText, setAliasText] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!profile.data || ready) return;
    const id = profile.data.identity ?? {};
    const a: Record<string, string> = {};
    for (const [k] of ANSWER_KEYS) a[k] = id[k] == null ? "" : String(id[k]);
    setAnswers(a);
    setLinks({ ...(id.links ?? {}) });
    setCustom(Array.isArray(id.autofill_answers) ? id.autofill_answers : []);
    const at: Record<string, string> = {};
    for (const [k, v] of Object.entries(profile.data.aliases ?? {})) at[k] = (v as string[]).join(", ");
    setAliasText(at);
    setReady(true);
  }, [profile.data, ready]);

  const save = useMutation({
    mutationFn: () => {
      const identity: any = {};
      for (const [k] of ANSWER_KEYS) identity[k] = (answers[k] ?? "").trim();
      identity.links = links;
      identity.autofill_answers = custom.filter((c) => c.match.trim() && c.answer.trim());
      const aliases: Record<string, string[]> = {};
      for (const [k, raw] of Object.entries(aliasText)) {
        const list = String(raw)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (list.length) aliases[k] = list;
      }
      return appFetch("/profile", { method: "PUT", body: { identity, aliases }, _auth: true });
    },
    meta: { invalidates: [["profile"], ["autofill", "schema"], ["cvs"], ["jobs"], ["analytics"]] },
    onSuccess: () => toast("Autofill details saved — the extension uses them on the next fill", "success"),
    onError: (e: any) => toast(e.message ?? "Save failed", "error"),
  });

  if (profile.isPending || !ready) return <Skeleton className="h-[60vh] w-full" />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;

  const aliasKeys = (schema.data?.fields ?? []).filter((f) => !f.key.startsWith("custom.")).map((f) => f.key);
  const policy = schema.data?.confidence_policy;
  const guardrails = schema.data?.guardrails?.never_fill ?? ["password", "credit_card", "ssn", "cvv"];

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        {/* header explainer */}
        <Card className="p-5">
          <h2 className="font-display text-lg font-bold">What the extension fills — and what it refuses to</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything below flows straight into <strong>Fill this page</strong> in the JAMS Autofill extension. Edit it here, press Save, and the
            next fill on any job form uses the new values.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="mint">≥ {Math.round((policy?.auto_fill ?? 0.85) * 100)}% fills green</Badge>
            <Badge tone="amber">
              {Math.round((policy?.fill_flagged ?? 0.55) * 100)}–{Math.round((policy?.auto_fill ?? 0.85) * 100)}% fills amber, flagged to review
            </Badge>
            <Badge>below that stays empty — never guessed</Badge>
            <Badge tone="rose">never: {guardrails.join(", ")}</Badge>
          </div>
        </Card>

        {/* application answers */}
        <Card className="p-5">
          <Section icon={<Sparkles className="h-4 w-4" />} title="Application answers" />
          <div className="grid gap-3 sm:grid-cols-2">
            {ANSWER_KEYS.map(([k, label]) => (
              <Field key={k} label={label}>
                <Input value={answers[k] ?? ""} onChange={(e) => setAnswers({ ...answers, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {LINK_KEYS.map(([k, label]) => (
              <Field key={k} label={label}>
                <Input value={links[k] ?? ""} onChange={(e) => setLinks({ ...links, [k]: e.target.value })} placeholder={`https://${k}.com/…`} />
              </Field>
            ))}
          </div>
        </Card>

        {/* custom Q&A */}
        <Card className="p-5">
          <Section icon={<Plus className="h-4 w-4" />} title="Custom answers for recurring questions" />
          <p className="-mt-2 mb-3 text-sm text-muted-foreground">
            Tired of typing the same reply? Write it once: if a form question <em>contains</em> your snippet, your answer is filled — verbatim, at
            90% confidence. Example: contains <code className="rounded bg-muted px-1">how did you hear about this job</code> → answer{" "}
            <code className="rounded bg-muted px-1">LinkedIn</code>.
          </p>
          <div className="space-y-2">
            {custom.map((c, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <Field label="When the form asks contains…" className="min-w-[220px] flex-1">
                  <Input
                    value={c.match}
                    placeholder="e.g. require sponsorship for employment visa"
                    onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, match: e.target.value } : x)))}
                  />
                </Field>
                <Field label="Answer with" className="min-w-[180px] flex-1">
                  <Input
                    value={c.answer}
                    placeholder="e.g. No"
                    onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                  />
                </Field>
                <button
                  className="mb-1 grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:text-rose-600"
                  onClick={() => setCustom(custom.filter((_, j) => j !== i))}
                  aria-label="Remove answer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {custom.length === 0 && <InlineBanner tone="info" title="No custom answers yet">Add one for any question you answer on every application.</InlineBanner>}
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setCustom([...custom, { match: "", answer: "" }])}>
            <Plus className="h-3.5 w-3.5" /> Add answer
          </Button>
        </Card>

        {/* aliases */}
        <Card className="p-5">
          <Section icon={<ShieldCheck className="h-4 w-4" />} title="Label aliases (teach the matcher your wording)" />
          <p className="-mt-2 mb-3 text-sm text-muted-foreground">
            Some forms use phrasing the matcher doesn’t know. Add comma-separated alternatives per key — they join the built-in aliases.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {aliasKeys.map((k) => (
              <Field key={k} label={k.replace(/^(identity|posting)\./, "")}>
                <Input
                  value={aliasText[k] ?? ""}
                  placeholder="comma, separated, alternatives"
                  onChange={(e) => setAliasText({ ...aliasText, [k]: e.target.value })}
                />
              </Field>
            ))}
            {aliasKeys.length === 0 && <p className="text-sm text-muted-foreground">Schema unavailable — save still works, aliases will attach later.</p>}
          </div>
        </Card>
      </div>

      {/* side rail */}
      <div className="space-y-5">
        <Card className="sticky top-24 p-5">
          <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save autofill details"}
          </Button>
          <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
            <li>· EEOC / voluntary self-ID questions are never answered for you.</li>
            <li>· Passwords, card numbers, SSN and CVV are never touched.</li>
            <li>· Resume, transcript and cover-letter files attach by hand.</li>
            <li>· Nothing ever submits — you press Submit yourself.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Section({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="font-display mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {title}
    </h2>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
