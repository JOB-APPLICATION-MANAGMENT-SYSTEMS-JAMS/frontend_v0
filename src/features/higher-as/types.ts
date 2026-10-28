/** The API contract for Higher As, kept beside the screens that consume it. */

export type Trade = { slug: string; label: string };

export type Rating = {
  avg: number | null;
  count: number;
  verified: number;
  distribution: { star: number; count: number }[];
};

export type ProPost = {
  id: string;
  title: string;
  body: string;
  kind: "work" | "service";
  image_url: string | null;
  tags: string[];
  auto_summary: string | null;
  created_at: string;
};

export type CredentialStatus = "pending" | "verified" | "rejected" | "expired";

export type Credential = {
  id: string;
  kind: string;
  title: string;
  issuer: string | null;
  reference?: string | null;
  issued_on: string | null;
  expires_on: string | null;
  status: CredentialStatus;
  reviewed_at?: string | null;
  review_note?: string | null;
  document_name?: string | null;
};

export type ProReview = {
  id: string;
  customer_name: string;
  rating: number;
  body: string;
  verified: boolean;
  engagement_id?: string | null;
  response: string | null;
  responded_at: string | null;
  dispute_status: "none" | "open" | "upheld" | "dismissed";
  dispute_reason?: string | null;
  hidden: boolean;
  created_at: string;
};

export type Engagement = {
  id: string;
  title: string;
  detail: string | null;
  completed_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  awaiting_confirm?: boolean;
};

export type ProSummary = {
  id: string;
  user_id: string;
  display_name: string;
  trade: string;
  trade_label: string;
  headline: string | null;
  summary: string;
  city: string | null;
  service_area: string | null;
  years_experience: number | null;
  available: boolean;
  day_rate_min: number | null;
  day_rate_max: number | null;
  currency: string;
  rating: Rating;
  credentials: { verified: number; pending: number; total: number };
  latest_post: ProPost | null;
  saved: boolean;
  is_owner: boolean;
  match: { score: number; reasons: string[] };
};

export type FeedResponse = {
  items: ProSummary[];
  total: number;
  facets: { trade: Record<string, number>; city: Record<string, number> };
  trades: Trade[];
  viewer: { city: string; saved: number };
  reviews: { pro_id: string; body: string; created_at: string }[];
};

export type ProProfile = Omit<ProSummary, "credentials" | "latest_post" | "match"> & {
  website: string | null;
  has_contact: boolean;
  credentials: Credential[];
  posts: ProPost[];
  reviews: ProReview[];
  can_review: boolean;
  reviewable_engagement: { id: string; title: string } | null;
  my_review: { id: string; rating: number; body: string } | null;
  is_admin: boolean;
};

export type Workspace = {
  profile: ProProfile | null;
  trades: Trade[];
  credentials: Credential[];
  posts: ProPost[];
  reviews: ProReview[];
  engagements: Engagement[];
};

export type ProContact = {
  display_name: string;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  city: string | null;
  service_area: string | null;
  note: string;
};
