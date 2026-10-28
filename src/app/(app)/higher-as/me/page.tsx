"use client";

/**
 * The professional's own workspace, inside Resume Studio's orbit.
 *
 * A trade professional should not have to build a corporate resume first. This is
 * where the profile, the work, the credential submissions and the replies live.
 * It is also where the product is honest about what it cannot do for you: nothing
 * here verifies anything, and the page says so next to the form.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, FileUp, HardHat, Plus, Send, ShieldCheck, Trash2, Wrench } from "lucide-react";
import { appFetch } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { Workspace } from "@/features/higher-as/types";
import { Badge, Button, Card, Chip, Input, Label, Select, Skeleton, Textarea } from "@/components/ui/base";
import { EmptyState, ErrorState, InlineBanner } from "@/components/ui/feedback";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { Modal } from "@/components/ui/modal";
import { CredentialStatusBadge, dateOrDash, VerificationNote, VerifiedJobTag } from "@/features/higher-as/ui";
import { toast } from "@/hooks/use-toast";

const TABS = ["Profile", "Work", "Credentials", "Reviews", "Jobs"] as const;
type Tab = (typeof TABS)[number];

export default function MyProPage() {
  const ws = useQuery<Workspace>({
    queryKey: ["higher-as", "me"],
    queryFn: () => appFetch("/higher-as/me", { _auth: true }),
  });

  if (ws.isPending) {
    return (
      <PageShell>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }
  if (ws.error) {
    return (
      <PageShell>
        <ErrorState error={ws.error} onRetry={() => ws.refetch()} />
      </PageShell>
    );
  }
  return <WorkspaceInner data={ws.data!} />;
}

function WorkspaceInner({ data }: { data: Workspace }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("Profile");
  const profile = data.profile;

  if (!profile) return <CreateProfile trades={data.trades} />;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Higher As · workspace"
        icon={<HardHat className="h-3.5 w-3.5" />}
        title={profile.display_name}
        description="Your public profile, the work you show, and the credentials you have submitted. Customers see the same record, minus your private contact details and documents."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => router.push(`/higher-as/${profile.id}`)}>
              <ExternalLink className="h-3.5 w-3.5" /> View public profile
            </Button>
          </>
        }
      />

      <div className="no-scrollbar fade-x -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {TABS.map((t) => (
          <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
            {t}
            {t === "Reviews" && profile.reviews.length > 0 ? <span className="opacity-60">{profile.reviews.length}</span> : null}
            {t === "Credentials" && profile.credentials.length > 0 ? <span className="opacity-60">{profile.credentials.length}</span> : null}
          </Chip>
        ))}
      </div>

      {tab === "Profile" && <ProfileForm profile={profile} trades={data.trades} />}
      {tab === "Work" && <WorkTab posts={data.posts} />}
      {tab === "Credentials" && <CredentialsTab credentials={data.credentials} />}
      {tab === "Reviews" && <ReviewsTab reviews={data.reviews} />}
      {tab === "Jobs" && <JobsTab engagements={data.engagements} />}
    </PageShell>
  );
}

/* ───────────────────────────── create profile ─────────────────────────── */

function CreateProfile({ trades }: { trades: Workspace["trades"] }) {
  const router = useRouter();
  const me = useQuery<{ identity?: { full_name?: string; name?: string; location?: string; phone?: string } }>({
    queryKey: qk.profile(),
    queryFn: () => appFetch("/profile", { _auth: true }),
    staleTime: 60_000,
  });
  const [name, setName] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const [city, setCity] = React.useState("");
  const [summary, setSummary] = React.useState("");

  // prefill from the profile only until the user types, so a late query never
  // overwrites an answer they already gave
  const suggestedName = name || me.data?.identity?.full_name || me.data?.identity?.name || "";
  const suggestedCity = city || me.data?.identity?.location || "";

  const create = useMutation({
    mutationFn: () =>
      appFetch("/higher-as/me", {
        method: "PUT",
        body: { display_name: suggestedName.trim(), trade, city: suggestedCity.trim() || undefined, summary: summary.trim() || undefined },
        _auth: true,
      }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Could not create the profile" },
    onSuccess: () => {
      toast("Professional profile created", "success");
      router.push("/higher-as/me");
    },
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="Higher As"
        icon={<Wrench className="h-3.5 w-3.5" />}
        title="Publish your trade"
        description="One profile for the work you do: what you fix, where you cover, and the documents you can prove. No corporate resume required."
      />
      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Name or business name</Label>
            <Input value={suggestedName} onChange={(e) => setName(e.target.value)} placeholder="Emeka Auto Works" />
          </div>
          <div>
            <Label>Trade</Label>
            <Select value={trade} onChange={(e) => setTrade(e.target.value)}>
              <option value="">Choose your trade</option>
              {trades.map((t) => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>City</Label>
            <Input value={suggestedCity} onChange={(e) => setCity(e.target.value)} placeholder="Lagos" />
          </div>
          <div>
            <Label>What you do</Label>
            <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Engine diagnostics, cooling systems, mobile call-outs." />
          </div>
        </div>
        <Button className="mt-4" onClick={() => create.mutate()} disabled={create.isPending || !suggestedName.trim() || !trade}>
          {create.isPending ? "Creating…" : "Create professional profile"}
        </Button>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          You can edit every field later. A new profile is unverified by definition; credentials start as pending review.
        </p>
      </Card>
    </PageShell>
  );
}

/* ───────────────────────────── profile form ───────────────────────────── */

function ProfileForm({ profile, trades }: { profile: NonNullable<Workspace["profile"]>; trades: Workspace["trades"] }) {
  const [form, setForm] = React.useState({
    display_name: profile.display_name,
    trade: profile.trade,
    headline: profile.headline ?? "",
    summary: profile.summary,
    city: profile.city ?? "",
    service_area: profile.service_area ?? "",
    years_experience: profile.years_experience != null ? String(profile.years_experience) : "",
    phone: "",
    whatsapp: "",
    website: profile.website ?? "",
    available: profile.available,
    day_rate_min: profile.day_rate_min != null ? String(profile.day_rate_min) : "",
    day_rate_max: profile.day_rate_max != null ? String(profile.day_rate_max) : "",
    currency: profile.currency,
  });

  const save = useMutation({
    mutationFn: () =>
      appFetch("/higher-as/me", {
        method: "PUT",
        body: {
          display_name: form.display_name.trim(),
          trade: form.trade,
          headline: form.headline.trim() || undefined,
          summary: form.summary.trim() || undefined,
          city: form.city.trim() || undefined,
          service_area: form.service_area.trim() || undefined,
          years_experience: form.years_experience ? Number(form.years_experience) : undefined,
          // a blank contact field clears it rather than keeping the old number
          phone: form.phone.trim() || undefined,
          whatsapp: form.whatsapp.trim() || undefined,
          website: form.website.trim() || undefined,
          available: form.available,
          day_rate_min: form.day_rate_min ? Number(form.day_rate_min) : undefined,
          day_rate_max: form.day_rate_max ? Number(form.day_rate_max) : undefined,
          currency: form.currency || undefined,
        },
        _auth: true,
      }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Profile not saved" },
    onSuccess: () => toast("Profile saved", "success"),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card className="p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Name or business</Label>
          <Input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
        </div>
        <div>
          <Label>Trade</Label>
          <Select value={form.trade} onChange={(e) => set("trade", e.target.value)}>
            {trades.map((t) => (
              <option key={t.slug} value={t.slug}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Headline</Label>
          <Input value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Engine diagnostics and cooling systems" />
        </div>
        <div className="sm:col-span-2">
          <Label>Summary</Label>
          <Textarea rows={4} value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="What you fix, how you work, what a customer should expect." />
        </div>
        <div>
          <Label>City</Label>
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <Label>Service area</Label>
          <Input value={form.service_area} onChange={(e) => set("service_area", e.target.value)} placeholder="Ikeja, Yaba, Surulere" />
        </div>
        <div>
          <Label>Years of experience</Label>
          <Input type="number" min={0} max={70} value={form.years_experience} onChange={(e) => set("years_experience", e.target.value)} />
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={form.currency} onChange={(e) => set("currency", e.target.value)}>
            {["NGN", "USD", "GBP", "EUR", "KES", "GHS"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Day rate, minimum</Label>
          <Input type="number" min={0} value={form.day_rate_min} onChange={(e) => set("day_rate_min", e.target.value)} placeholder="25000" />
        </div>
        <div>
          <Label>Day rate, maximum</Label>
          <Input type="number" min={0} value={form.day_rate_max} onChange={(e) => set("day_rate_max", e.target.value)} placeholder="60000" />
        </div>
        <div>
          <Label>Phone (private)</Label>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder={profile.has_contact ? "Leave blank to keep the current number" : "+234…"} />
        </div>
        <div>
          <Label>WhatsApp (private)</Label>
          <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder={profile.has_contact ? "Leave blank to keep the current number" : "+234…"} />
        </div>
        <div className="sm:col-span-2">
          <Label>Website</Label>
          <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip active={form.available} onClick={() => set("available", !form.available)}>
          {form.available ? "Available for work" : "Not taking work"}
        </Chip>
        <Button className="ml-auto" onClick={() => save.mutate()} disabled={save.isPending || !form.display_name.trim()}>
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>

      <InlineBanner tone="info" className="mt-3" title="Phone numbers are private">
        Customers who open your profile can request your contact details; they never appear in the public feed or in search results.
      </InlineBanner>
    </Card>
  );
}

/* ───────────────────────────────── work ──────────────────────────────── */

function WorkTab({ posts }: { posts: Workspace["posts"] }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [image, setImage] = React.useState("");
  const [kind, setKind] = React.useState<"work" | "service">("work");
  const [tags, setTags] = React.useState("");

  const create = useMutation({
    mutationFn: () =>
      appFetch("/higher-as/posts", {
        method: "POST",
        body: { title: title.trim(), body: body.trim() || undefined, kind, image_url: image.trim() || undefined, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) },
        _auth: true,
      }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Post not published" },
    onSuccess: () => {
      toast("Work published", "success");
      setTitle("");
      setBody("");
      setImage("");
      setTags("");
      setOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => appFetch(`/higher-as/posts/${id}`, { method: "DELETE", _auth: true }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Post not removed" },
    onSuccess: () => toast("Post removed", "info"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Show a finished job or describe a service. The auto summary is built from your own words; you can edit the post any time by posting again.</p>
        <Button size="sm" variant="azure" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add work
        </Button>
      </div>

      {posts.length === 0 ? (
        <EmptyState icon={<Wrench className="h-6 w-6" />} title="No work yet" description="A photo and two sentences about a real job is worth more than a long skills list." action={<Button variant="azure" onClick={() => setOpen(true)}>Add your first post</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((p) => (
            <Card key={p.id} className="flex flex-col overflow-hidden">
              {p.image_url && <div className="h-36 bg-cover bg-center" style={{ backgroundImage: `url(${p.image_url})` }} role="img" aria-label={p.title} />}
              <div className="flex flex-1 flex-col gap-2 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-sm font-bold">{p.title}</p>
                  <Badge tone="neutral" className="capitalize">{p.kind}</Badge>
                </div>
                {p.body && <p className="text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>}
                {p.auto_summary && <p className="rounded-lg border border-border bg-muted/50 p-2 text-[11px]">{p.auto_summary}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
                  <span className="text-[10px] text-muted-foreground">{p.created_at.slice(0, 10)}</span>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)} disabled={remove.isPending} aria-label={`Delete ${p.title}`}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} label="Add work" className="max-w-lg">
        <p className="font-display text-lg font-bold">Add work</p>
        <p className="mt-1 text-xs text-muted-foreground">Describe a real job or service. Do not claim certifications or experience you cannot support.</p>
        <Label className="mt-3 block">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cooling system rebuild, 2014 Corolla" />
        <Label className="mt-3 block">What was done</Label>
        <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Replaced the water pump, thermostat and hoses. Pressure-tested the system." />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Type</Label>
            <Select value={kind} onChange={(e) => setKind(e.target.value as "work" | "service")}>
              <option value="work">Finished job</option>
              <option value="service">Service offered</option>
            </Select>
          </div>
          <div>
            <Label>Tags</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="cooling, diagnostics" />
          </div>
        </div>
        <Label className="mt-3 block">Image URL (optional)</Label>
        <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || title.trim().length < 3}>
            {create.isPending ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ───────────────────────────── credentials ───────────────────────────── */

function CredentialsTab({ credentials }: { credentials: Workspace["credentials"] }) {
  const [title, setTitle] = React.useState("");
  const [kind, setKind] = React.useState("licence");
  const [issuer, setIssuer] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [issued, setIssued] = React.useState("");
  const [expires, setExpires] = React.useState("");
  const [docName, setDocName] = React.useState("");
  const [docB64, setDocB64] = React.useState("");

  const submit = useMutation({
    mutationFn: () =>
      appFetch("/higher-as/credentials", {
        method: "POST",
        body: {
          kind,
          title: title.trim(),
          issuer: issuer.trim() || undefined,
          reference: reference.trim() || undefined,
          issued_on: issued || undefined,
          expires_on: expires || undefined,
          document_name: docName || undefined,
          document_b64: docB64 || undefined,
        },
        _auth: true,
      }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Credential not submitted" },
    onSuccess: () => {
      toast("Submitted for review. It is not verified until a reviewer decides", "info");
      setTitle("");
      setIssuer("");
      setReference("");
      setIssued("");
      setExpires("");
      setDocName("");
      setDocB64("");
    },
  });

  const pickFile = (file?: File) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast("Keep the scan under 4 MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      setDocB64(result.split(",")[1] ?? "");
      setDocName(file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <Card className="p-4">
        <h2 className="eyebrow">Submit a credential</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          A licence, certificate or training record. Uploading it puts it in the review queue; it does not verify you.
        </p>
        <div className="mt-3 grid gap-3">
          <div>
            <Label>What is it?</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="NATA vehicle inspection licence" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Type</Label>
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="licence">Licence</option>
                <option value="certificate">Certificate</option>
                <option value="training">Training</option>
                <option value="registration">Registration</option>
              </Select>
            </div>
            <div>
              <Label>Issuer</Label>
              <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="NATA" />
            </div>
            <div>
              <Label>Issued</Label>
              <Input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} />
            </div>
            <div>
              <Label>Expires</Label>
              <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Reference number (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <Label>Document (optional, private)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground hover:border-ember/40">
              <FileUp className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">{docName || "Choose a scan or photo, max 4 MB"}</span>
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
          </div>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || title.trim().length < 3}>
            {submit.isPending ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="eyebrow">Your submissions</h2>
        {credentials.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Nothing submitted yet. A missing credential is not a red flag; an invented one is.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {credentials.map((c) => (
              <li key={c.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground">{[c.issuer, c.kind].filter(Boolean).join(" · ")}</p>
                  </div>
                  <CredentialStatusBadge status={c.status} />
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {c.issued_on ? `Issued ${dateOrDash(c.issued_on)}` : "No issue date"}
                  {c.expires_on ? ` · expires ${dateOrDash(c.expires_on)}` : ""}
                  {c.document_name ? ` · ${c.document_name} on file` : " · no document attached"}
                </p>
                {c.review_note && <p className="mt-1 text-[11px] text-muted-foreground">Reviewer: {c.review_note}</p>}
              </li>
            ))}
          </ul>
        )}
        <VerificationNote className="mt-3 border-t border-border pt-2.5" />
      </Card>
    </div>
  );
}

/* ─────────────────────────────── reviews ─────────────────────────────── */

function ReviewsTab({ reviews }: { reviews: Workspace["reviews"] }) {
  const [responding, setResponding] = React.useState<string | null>(null);
  const [response, setResponse] = React.useState("");
  const [disputing, setDisputing] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");

  const respond = useMutation({
    mutationFn: (id: string) => appFetch(`/higher-as/reviews/${id}/response`, { method: "POST", body: { response }, _auth: true }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Reply not saved" },
    onSuccess: () => {
      toast("Reply published", "success");
      setResponding(null);
      setResponse("");
    },
  });

  const dispute = useMutation({
    mutationFn: (id: string) => appFetch(`/higher-as/reviews/${id}/dispute`, { method: "POST", body: { reason }, _auth: true }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Could not send for moderation" },
    onSuccess: () => {
      toast("Sent to moderation", "info");
      setDisputing(null);
      setReason("");
    },
  });

  if (reviews.length === 0) {
    return <EmptyState title="No reviews yet" description="Reviews arrive after customers record a job. You confirm the job, they write the review, and neither side can edit the other." />;
  }

  return (
    <div className="space-y-3">
      <InlineBanner tone="info" title="You can reply, not rewrite">
        A reply sits under the review. You cannot change its rating or delete it; if it breaks the rules, request moderation and a reviewer decides.
      </InlineBanner>
      {reviews.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold">{r.customer_name}</span>
            <span className="text-[11px] text-muted-foreground">{r.rating}/5</span>
            {r.verified ? <VerifiedJobTag /> : <span className="text-[11px] text-muted-foreground">unverified feedback</span>}
            {r.dispute_status === "open" && <span className="text-[11px] text-muted-foreground">in moderation</span>}
            <span className="ml-auto text-[10px] text-muted-foreground">{r.created_at.slice(0, 10)}</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed">{r.body}</p>
          {r.response && (
            <div className="mt-2 rounded-xl border-l-2 border-ember/50 bg-muted/40 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your reply</p>
              <p className="mt-0.5 text-[12px]">{r.response}</p>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {!r.response && (
              <Button size="sm" variant="ghost" onClick={() => { setResponding(responding === r.id ? null : r.id); setResponse(""); }}>
                {responding === r.id ? "Cancel" : "Reply"}
              </Button>
            )}
            {r.dispute_status === "none" && (
              <Button size="sm" variant="ghost" onClick={() => setDisputing(r.id)}>Request moderation</Button>
            )}
          </div>
          {responding === r.id && (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Add context about the job" />
              <Button size="sm" onClick={() => respond.mutate(r.id)} disabled={respond.isPending || response.trim().length < 2}>
                <Send className="h-3.5 w-3.5" /> Publish
              </Button>
            </div>
          )}
        </Card>
      ))}

      <Modal open={!!disputing} onClose={() => setDisputing(null)} label="Request moderation" className="max-w-md">
        <p className="font-display text-lg font-bold">Request moderation</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">The review stays visible while a reviewer reads it. Its rating is never edited.</p>
        <Label className="mt-3 block">Why should it be reviewed?</Label>
        <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="It contains personal information, or it describes a job I have no record of." />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDisputing(null)}>Cancel</Button>
          <Button onClick={() => disputing && dispute.mutate(disputing)} disabled={dispute.isPending || reason.trim().length < 10}>Send</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ──────────────────────────────── jobs ───────────────────────────────── */

function JobsTab({ engagements }: { engagements: Workspace["engagements"] }) {
  const confirm = useMutation({
    mutationFn: (id: string) => appFetch(`/higher-as/engagements/${id}/confirm`, { method: "POST", _auth: true }),
    meta: { invalidates: [["higher-as"]], errorFallback: "Could not confirm the job" },
    onSuccess: () => toast("Job confirmed - their review can now count as verified", "success"),
  });

  if (engagements.length === 0) {
    return <EmptyState title="No recorded jobs" description="When a customer records a job with you, it appears here for confirmation. Only you can confirm your own work." />;
  }

  return (
    <Card className="p-4">
      <h2 className="eyebrow flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Recorded jobs</h2>
      <ul className="mt-3 divide-y divide-border">
        {engagements.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{e.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{e.detail || "No details supplied"}</p>
            </div>
            {e.confirmed_at ? (
              <Badge tone="mint" className="gap-1"><ShieldCheck className="h-3 w-3" /> confirmed</Badge>
            ) : (
              <Button size="sm" onClick={() => confirm.mutate(e.id)} disabled={confirm.isPending}>Confirm it happened</Button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">Confirming does not create a review and does not affect your rating. It only lets the customer review carry the verified-service label.</p>
    </Card>
  );
}
