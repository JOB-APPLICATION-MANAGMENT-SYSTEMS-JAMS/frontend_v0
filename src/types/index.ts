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
  capture: any;
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
  payload: any;
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

export interface CV {
  id: string;
  name: string;
  archetype: "opening" | "pitch";
  career_category: string;
  targeting: { seniority?: string[]; keywords?: string[]; companies?: string[] };
  blocks: CVBlock[];
  lineage: { forked_from?: string; forked_at?: string };
  updated_at: string;
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
  contacts?: any[];
  stack?: string[];
}

export interface Badge {
  key: string;
  label: string;
  unlocked: boolean;
  unlocked_at: string | null;
}
