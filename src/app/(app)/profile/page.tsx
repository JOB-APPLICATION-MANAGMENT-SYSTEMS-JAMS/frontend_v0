"use client";

/** Profile (§19.3): the master form, one save feeds CVs, autofill, templates and scoring. */
import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Award, GraduationCap, Link2, Plus, Save, Sparkles, Trash2, UserRound } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import { Badge, Button, Card, Input, Label, Skeleton, Textarea } from "@/components/ui/base";
import { ErrorState, InlineBanner } from "@/components/ui/feedback";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Profile = {
  identity: any;
  prefs: any;
  aliases: any;
  version: number;
  skills: { id: string; name: string; level: string | null; years: number | null; is_top5: number }[];
  experiences: { id: string; company: string; title: string; start_date: string | null; end_date: string | null; bullets: string[] }[];
  education: { id: string; school: string; degree: string | null; field: string | null }[];
};

export default function ProfilePage() {
  const profile = useQuery<Profile>({ queryKey: qk.profile(), queryFn: () => appFetch("/profile", { _auth: true }) });
  const completeness = useQuery<{ score: number; checks: any[]; suggestions: { label: string; hint: string }[] }>({
    queryKey: qk.completeness(),
    queryFn: () => appFetch("/profile/completeness", { _auth: true }),
  });

  const [draft, setDraft] = React.useState<Profile | null>(null);
  React.useEffect(() => {
    if (profile.data && !draft) setDraft(profile.data);
  }, [profile.data, draft]);

  const save = useMutation({
    // strip half-filled rows the "Add" buttons can leave behind: one blank skill
    // must not fail the whole save with a raw validation error
    mutationFn: () => {
      const body = {
        ...draft,
        skills: (draft?.skills ?? []).filter((s) => s.name.trim()),
        experiences: (draft?.experiences ?? []).filter((e) => e.title.trim() && e.company.trim()),
        education: (draft?.education ?? []).filter((e) => e.school.trim()),
      };
      return appFetch("/profile", { method: "PUT", body, _auth: true });
    },
    meta: { invalidates: [["profile"], ["cvs"], ["jobs"], ["analytics"]] },
    onSuccess: () => {
      toast("Profile saved: CVs, autofill and scoring updated", "success");
      completeness.refetch();
    },
    onError: (e: any) => toast(e.message ?? "Save failed", "error"),
  });

  if (profile.isPending || !draft) return <Skeleton className="h-[60vh] w-full" />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;

  const id = draft.identity ?? {};
  const setId = (k: string, v: any) => setDraft({ ...draft, identity: { ...id, [k]: v } });
  const pref = draft.prefs ?? {};
  const setPref = (k: string, v: any) => setDraft({ ...draft, prefs: { ...pref, [k]: v } });

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        {/* completeness */}
        <Card className="flex items-center gap-5 p-5">
          <div className="relative grid h-20 w-20 place-items-center">
            <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--line))" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="hsl(var(--ember))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={2 * Math.PI * 34 * (1 - (completeness.data?.score ?? 0) / 100)}
                style={{ transition: "stroke-dashoffset 800ms cubic-bezier(.23,1,.32,1)" }}
              />
            </svg>
            <span className="font-display text-lg font-extrabold">{completeness.data?.score ?? 0}%</span>
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold">Profile completeness</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(completeness.data?.suggestions ?? []).slice(0, 4).map((s) => (
                <Badge key={s.label} tone="amber">
                  + {s.label}
                </Badge>
              ))}
              {(completeness.data?.suggestions ?? []).length === 0 && <Badge tone="mint">complete, nice</Badge>}
            </div>
          </div>
        </Card>

        {/* identity */}
        <Card className="p-5">
          <Section icon={<UserRound className="h-4 w-4" />} title="Identity & contacts" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name"><Input value={id.name ?? ""} onChange={(e) => setId("name", e.target.value)} /></Field>
            <Field label="Headline"><Input value={id.headline ?? ""} onChange={(e) => setId("headline", e.target.value)} placeholder="Full-Stack Engineer, TS, React, Node" /></Field>
            <Field label="First name"><Input value={id.first_name ?? ""} onChange={(e) => setId("first_name", e.target.value)} placeholder="Israel" /></Field>
            <Field label="Middle name"><Input value={id.middle_name ?? ""} onChange={(e) => setId("middle_name", e.target.value)} placeholder="Omokhagbo" /></Field>
            <Field label="Last name"><Input value={id.last_name ?? ""} onChange={(e) => setId("last_name", e.target.value)} placeholder="Iraoya" /></Field>
            <Field label="Email"><Input value={id.email ?? ""} onChange={(e) => setId("email", e.target.value)} /></Field>
            <Field label="Phone"><Input value={id.phone ?? ""} onChange={(e) => setId("phone", e.target.value)} /></Field>
            <Field label="Location"><Input value={id.location ?? ""} onChange={(e) => setId("location", e.target.value)} /></Field>
            <Field label="Work authorization (Yes/No)"><Input value={id.work_authorization ?? ""} onChange={(e) => setId("work_authorization", e.target.value)} placeholder="Yes" /></Field>
            <Field label="Requires visa sponsorship (Yes/No)"><Input value={id.sponsorship ?? ""} onChange={(e) => setId("sponsorship", e.target.value)} placeholder="No" /></Field>
            <Field label="Office / relocation answer">
              <Input value={id.relocation ?? ""} onChange={(e) => setId("relocation", e.target.value)} placeholder="Yes, I live locally" />
            </Field>
            <Field label="Graduation year"><Input value={id.graduation_year ?? ""} onChange={(e) => setId("graduation_year", e.target.value)} placeholder="2028" /></Field>
            <Field label="How did you hear about a job?">
              <Input value={id.heard_about ?? ""} onChange={(e) => setId("heard_about", e.target.value)} placeholder="LinkedIn" />
            </Field>
            <Field label="Salary expectation (USD)"><Input type="number" value={id.salary_expectation ?? ""} onChange={(e) => setId("salary_expectation", Number(e.target.value))} /></Field>
            <Field label="Seniority"><Input value={pref.seniority ?? ""} onChange={(e) => setPref("seniority", e.target.value)} placeholder="junior | mid | senior | staff" /></Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            First / middle / last fill their own form fields — leave them blank and they’re derived from Full name. Education selects (school, degree, discipline) come from the Education card below.
          </p>
          <Field label="Pitch paragraph (templates merge this)">
            <Textarea rows={3} value={id.pitch ?? ""} onChange={(e) => setId("pitch", e.target.value)} placeholder="I build typed, well-tested product surfaces end-to-end…" />
          </Field>
        </Card>

        {/* links */}
        <Card className="p-5">
          <Section icon={<Link2 className="h-4 w-4" />} title="Links" />
          <div className="grid gap-3 sm:grid-cols-3">
            {["github", "linkedin", "website"].map((k) => (
              <Field key={k} label={k}>
                <Input value={id.links?.[k] ?? ""} onChange={(e) => setId("links", { ...(id.links ?? {}), [k]: e.target.value })} placeholder={`https://${k}.com/…`} />
              </Field>
            ))}
          </div>
        </Card>

        {/* skills */}
        <Card className="p-5">
          <Section icon={<Sparkles className="h-4 w-4" />} title="Skills (these power ranking)" />
          <div className="space-y-2">
            {draft.skills.map((s, i) => (
              <div key={s.id ?? i} className="flex items-center gap-2">
                <Input
                  value={s.name}
                  onChange={(e) => {
                    const skills = [...draft.skills];
                    skills[i] = { ...s, name: e.target.value };
                    setDraft({ ...draft, skills });
                  }}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={s.years ?? ""}
                  placeholder="yrs"
                  onChange={(e) => {
                    const skills = [...draft.skills];
                    skills[i] = { ...s, years: Number(e.target.value) || null };
                    setDraft({ ...draft, skills });
                  }}
                  className="w-20"
                />
                <button
                  onClick={() => setDraft({ ...draft, skills: draft.skills.filter((_, j) => j !== i) })}
                  className={cn("grid h-9 w-9 place-items-center rounded-xl border", s.is_top5 ? "border-orange-600 bg-orange-600/12 text-orange-700 dark:border-orange-500 dark:bg-orange-500/12 dark:text-orange-400" : "border-border text-muted-foreground")}
                  title="Top-5 skill (weights ×1.5 in scoring)"
                >
                  ★
                </button>
                <button onClick={() => setDraft({ ...draft, skills: draft.skills.filter((_, j) => j !== i) })} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setDraft({ ...draft, skills: [...draft.skills, { id: "", name: "", level: null, years: null, is_top5: 0 }] })}>
            <Plus className="h-3.5 w-3.5" /> Add skill
          </Button>
        </Card>

        {/* experience */}
        <Card className="p-5">
          <Section icon={<Award className="h-4 w-4" />} title="Experience" />
          <div className="space-y-4">
            {draft.experiences.map((e, i) => {
              const upd = (patch: any) => {
                const experiences = [...draft.experiences];
                experiences[i] = { ...e, ...patch };
                setDraft({ ...draft, experiences });
              };
              return (
                <div key={e.id ?? i} className="rounded-xl border border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input value={e.title} placeholder="Title" onChange={(ev) => upd({ title: ev.target.value })} />
                    <Input value={e.company} placeholder="Company" onChange={(ev) => upd({ company: ev.target.value })} />
                    <Input value={e.start_date ?? ""} placeholder="2022-03" onChange={(ev) => upd({ start_date: ev.target.value })} />
                    <Input value={e.end_date ?? ""} placeholder="present" onChange={(ev) => upd({ end_date: ev.target.value })} />
                  </div>
                  <Textarea
                    className="mt-2"
                    rows={3}
                    value={(e.bullets ?? []).join("\n")}
                    onChange={(ev) => upd({ bullets: ev.target.value.split("\n").filter(Boolean) })}
                    placeholder={"One bullet per line\nLed migration of…"}
                  />
                  <button className="mt-1 text-xs text-rose-600 hover:underline" onClick={() => setDraft({ ...draft, experiences: draft.experiences.filter((_, j) => j !== i) })}>
                    remove
                  </button>
                </div>
              );
            })}
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setDraft({ ...draft, experiences: [...draft.experiences, { id: "", company: "", title: "", start_date: null, end_date: null, bullets: [] }] })}>
            <Plus className="h-3.5 w-3.5" /> Add experience
          </Button>
        </Card>

        {/* education */}
        <Card className="p-5">
          <Section icon={<GraduationCap className="h-4 w-4" />} title="Education" />
          <div className="space-y-2">
            {draft.education.map((e, i) => {
              const upd = (patch: any) => {
                const education = [...draft.education];
                education[i] = { ...e, ...patch };
                setDraft({ ...draft, education });
              };
              return (
                <div key={e.id ?? i} className="flex flex-wrap gap-2">
                  <Input value={e.school} placeholder="School" onChange={(ev) => upd({ school: ev.target.value })} className="min-w-[180px] flex-1" />
                  <Input value={e.degree ?? ""} placeholder="Degree" onChange={(ev) => upd({ degree: ev.target.value })} className="w-32" />
                  <Input value={e.field ?? ""} placeholder="Field" onChange={(ev) => upd({ field: ev.target.value })} className="w-40" />
                  <button className="text-xs text-rose-600" onClick={() => setDraft({ ...draft, education: draft.education.filter((_, j) => j !== i) })}>
                    remove
                  </button>
                </div>
              );
            })}
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setDraft({ ...draft, education: [...draft.education, { id: "", school: "", degree: null, field: null }] })}>
            <Plus className="h-3.5 w-3.5" /> Add education
          </Button>
        </Card>
      </div>

      {/* side rail */}
      <div className="space-y-5">
        <Card className="sticky top-24 p-5">
          <p className="text-xs text-muted-foreground">Version {draft.version} · last saved {profile.data ? "recently" : "n/a"}</p>
          <Button className="mt-3 w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save profile"}
          </Button>
          <InlineBanner tone="info" className="mt-4" title="Field aliases">
            Autofill maps foreign form labels using stored aliases, e.g. “Current position” → headline. Edit aliases in JSON below.
          </InlineBanner>
          <Textarea
            className="mt-3 font-mono text-xs"
            rows={5}
            value={JSON.stringify(draft.aliases ?? {}, null, 2)}
            onChange={(e) => {
              try {
                setDraft({ ...draft, aliases: JSON.parse(e.target.value) });
              } catch {
                /* while typing */
              }
            }}
          />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
