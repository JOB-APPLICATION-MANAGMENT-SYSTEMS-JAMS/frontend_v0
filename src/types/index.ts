/** Shared API + domain types (§12.1 envelope, §32 data model). */

export interface APIResponse<T = unknown> {
  status: "success" | "failure";
  status_code: number;
  message: string;
  data: T;
}

export interface Pagination {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

export interface Paged<T> {
  items: T[];
  pagination: Pagination;
}

export interface ScoreFactor {
  factor: string;
  weight: number;
  points: number;
  why: string;
}

export interface JobPosting {
  id: string;
  title: string;
  company: { name: string; id: string | null; tier: "dream" | "reach" | "safety" | null };
  location: string | null;
  remote: boolean;
  salary: { min: number; max: number; currency: string } | null;
  seniority: string | null;
  source: string;
  category: string;
  url: string;
  posted_at: string | null;
  score: number;
  explain: ScoreFactor[];
  applied: boolean;
  ignored: boolean;
  keywords: string[];
  description_snippet: string;
  /** apply-by-email address published in the posting text, when there is one */
  contact_email: string | null;
}

export interface SearchResponse extends Paged<JobPosting> {
  facets: Record<string, Record<string, number>>;
  took_ms: number;
  sources_ok: string[];
  sources_failed: { source: string; error: string }[];
}

export type AppStatus = "saved" | "applied" | "viewed" | "screen" | "interview" | "offer" | "rejected" | "ghosted" | "withdrawn";

export interface Application {
  id: string;
  company_name: string;
  company_id: string | null;
  posting_id: string | null;
  role_title: string;
  kind: "application" | "pitch";
  status: AppStatus;
  source: string | null;
  url: string | null;
  applied_at: string | null;
  replied_at: string | null;
  ghosted_at: string | null;
  first_reply_days: number | null;
  next_action_at: string | null;
  notes: string | null;
  tags: string[];
  capture?: Record<string, unknown> | null;
  cv_id: string | null;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppEvent {
  id: number;
  app_id: string;
  type: string;
  at: string;
  actor: string;
  payload?: { to?: string; classification?: string; note?: string; [k: string]: unknown } | null;
}

export interface Kpi {
  value: number;
  prev: number;
  delta_pct: number | null;
  unit?: string;
}

export interface Today {
  day: string;
  timezone: string;
  count: number;
  goal: number;
  hit: boolean;
  remaining: number;
  percent: number;
  streak: number;
  any_effort_streak: number;
  longest_streak: number;
  frozen: boolean;
  freeze_available: number;
  state: "cold" | "warming" | "burning" | "blazing";
}

export interface Summary {
  period: string;
  range: { from: string; to: string; prev_from: string; prev_to: string };
  kpis: Record<string, Kpi | Today> & { streak: Today };
  funnel: { key: string; label: string; count: number }[];
  median_time_to_reply_days: number | null;
  p90_time_to_reply_days: number | null;
}

/** Analytics payloads (§22): timeseries buckets, source breakdown rows, heatmap days. */
export type TimeseriesPoint = { bucket: string; count?: number; applied?: number; replied?: number };
export type BreakdownRow = { key: string; sent: number; replied: number; interviews: number; rate: number };
export type HeatmapDay = { day: string; count: number; goal: number; hit: boolean; streak: number };

/** A saved contact (§19.1). The table stores `role` (never `title`) and has no phone column. */
export interface Contact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  source_note?: string | null;
  never_contact?: number;
  created_at?: string;
}

export interface CV {
  id: string;
  name: string;
  archetype: "opening" | "pitch";
  career_category: string;
  targeting: { seniority?: string[]; keywords?: string[]; companies?: string[] };
  blocks: CVBlock[];
  /** The document's own settings; mirrors the backend's `design` column. */
  design: CvDesign;
  lineage: { forked_from?: string; forked_at?: string };
  updated_at: string;
  /** 1 once the owner lists it on the network for reviews */
  public?: number;
  /** the ownership line printed under a published CV */
  copyright?: string | null;
}

/**
 * Document settings (§24.1). Every field is optional and an absent field is the
 * measured default, so `{}` is the reference sheet. Mirrors `CvDesign` in
 * `backend/src/lib/cv-document.ts`, which is what actually resolves them.
 */
export interface CvDesign {
  page?: "a4" | "letter";
  /** `ink` | `ember` | `graphite`, or any hex. */
  accent?: string;
  font?: "serif" | "sans";
  base?: number;
  nameDelta?: number;
  headDelta?: number;
  entryDelta?: number;
  lineHeight?: number;
  sectionGap?: number;
  entryGap?: number;
  marginX?: number;
  marginY?: number;
  skillCols?: number;
  caps?: "none" | "capitalize" | "upper";
  rule?: boolean;
  headTone?: "accent" | "ink";
  datePos?: "left" | "right";
  align?: "center" | "left";
  icons?: "none" | "outline" | "circle" | "rounded" | "square" | "circle-fill" | "rounded-fill" | "square-fill";
  headIcons?: "none" | "outline" | "filled";
  links?: { underline?: boolean; colored?: boolean };
  dates?: "keep" | "month" | "dots" | "hide";
}

export interface CVBlock {
  type: "summary" | "experience" | "skills" | "projects" | "education" | "awards" | "custom";
  source?: "profile" | "local";
  ref?: string;
  text?: string;
  title?: string;
  bullets?: string[];
  groups?: string[];
}

export interface Template {
  id: string;
  kind: "cv" | "email";
  archetype: "opening" | "pitch";
  name: string;
  subject: string | null;
  body: string;
  variables: string[];
}

export interface Outreach {
  id: string;
  app_id: string | null;
  contact_id: string | null;
  step_no: number;
  subject: string;
  body: string;
  state: "draft" | "scheduled" | "sent_unverified" | "sent" | "paused" | "replied" | "bounced";
  scheduled_at: string | null;
  sent_at: string | null;
  opens: number;
  clicks: number;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  tier: "dream" | "reach" | "safety";
  careers_url: string | null;
  notes: string | null;
  applications?: number;
  /** list endpoints return a contact *count*; the detail endpoint returns the rows (Contact[]) */
  contacts?: number;
  stack?: string[];
}

/* ── the network: people, platform jobs, events, reviews ───────────────── */

export interface Match { score: number; reasons: string[]; }

export interface PersonCv {
  id: string;
  name: string;
  archetype: "opening" | "pitch";
  updated_at: string;
  public?: number;
  copyright?: string | null;
  rating: { avg: number; count: number } | null;
}

export interface Person {
  id: string;
  user_id: string;
  name: string;
  headline: string;
  profession: string;
  seniority: string;
  location: string;
  bio: string;
  links: Record<string, string>;
  offers: string[];
  looking_for: string;
  answers: { q: string; a: string }[];
  open_to: string[];
  visible: boolean;
  updated_at: string;
  is_me?: boolean;
  cv?: PersonCv | null;
  match?: Match;
  cvs?: { id: string; name: string; archetype: string; updated_at: string; public: number; copyright: string | null; reviews: { count: number; avg: number | null } }[];
  reviews?: CvReview[];
}

export interface PeopleResponse {
  items: Person[];
  total: number;
  facets: { profession: Record<string, number>; location: Record<string, number> };
  viewer: { name: string; headline: string; profession: string; profession_declared: boolean; city: string; seniority: string; skills: string[]; has_profile: boolean };
  me: Person | null;
  questions: { key: string; q: string; hint: string }[];
}

export interface PlatformJob {
  id: string;
  company: string;
  title: string;
  profession: string;
  seniority: string | null;
  location: string | null;
  remote: boolean;
  employment_type: string;
  salary: { min: number; max: number | null; currency: string } | null;
  description: string;
  tags: string[];
  contact_email: string | null;
  demo: boolean;
  posted_at: string;
  mine: boolean;
  match: Match;
}

export interface HirersResponse {
  items: PlatformJob[];
  total: number;
  facets: { profession: Record<string, number>; seniority: Record<string, number> };
  viewer: { name: string; headline: string; profession: string; profession_declared: boolean; city: string; skills: string[]; needs_profession: boolean };
  professions: string[];
  demo: boolean;
}

export type EventKind = "hiring" | "training" | "seminar" | "story" | "meetup" | "ad";

export interface EventListing {
  id: string;
  title: string;
  kind: EventKind;
  host: string;
  city: string;
  country: string;
  venue: string;
  format: "in-person" | "virtual" | "hybrid";
  starts_at: string;
  ends_at: string | null;
  description: string;
  tags: string[];
  url: string | null;
  price: string;
  seats: number | null;
  featured: boolean;
  demo: boolean;
  match: Match;
}

export interface EventsResponse {
  items: EventListing[];
  total: number;
  facets: { kind: Record<string, number>; city: Record<string, number>; format: Record<string, number> };
  viewer: { city: string; profession: string };
  kinds: EventKind[];
  demo: boolean;
}

export interface CvReview {
  id: string;
  cv_id: string;
  cv_name?: string;
  reviewer_name: string;
  reviewer_role: string | null;
  relationship: "hirer" | "recruiter" | "mentor" | "peer";
  rating: number;
  body: string;
  created_at: string;
  mine?: boolean;
}

export interface CvReviews {
  count: number;
  avg: number | null;
  distribution: { star: number; count: number }[];
  items: CvReview[];
}

export type RedlineRule =
  | "weak-verb"
  | "passive"
  | "first-person"
  | "filler"
  | "grammar"
  | "duplicate"
  | "no-figure"
  | "too-long"
  | "keyword";

export interface RedlineEdit {
  id: string;
  section: string;
  kind: "replace" | "add";
  before: string;
  after: string;
  reason: string;
  rule: RedlineRule;
  severity: "important" | "polish";
}

export interface RedlineReport {
  edits: RedlineEdit[];
  counts: { replace: number; add: number; important: number; polish: number };
  hygiene: number;
  summary: string;
  by_rule: { rule: RedlineRule; count: number; label: string }[];
}

export interface Badge {
  key: string;
  label: string;
  unlocked: boolean;
  unlocked_at: string | null;
}
