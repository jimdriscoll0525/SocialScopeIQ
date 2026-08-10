export type IntentTier = "TIER 1" | "TIER 2" | "TIER 3";
export type ResponseStatus = "DRAFT" | "POSTED" | "REPLIED" | "ENGAGED" | "IGNORED" | "DELETED";
export type FollowupStatus = "NOT STARTED" | "IN PROGRESS" | "DONE";
export type DetectedStateValue = "MA" | "NH" | "RI" | "NJ" | "ME" | "CT" | "FL" | "UNKNOWN" | "OUT_OF_STATE";

export type Role = "loan_officer" | "realtor";
export type FeedName = "lo" | "realtor";

export interface Profile {
  id: string;
  role: Role;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  slug: string;
  states_served: string[];
  towns_served: string[];
  niche: string | null;
  voice_sample: string | null;
  website: string | null;
  company: string | null;
  nmls: string | null;
  license_states: string[] | null;
  brokerage: string | null;
  license_numbers: string[] | null;
  case_studies: string | null;
  products_capabilities: string | null;
  social_links: string[] | null;
  is_admin: boolean;
  plan: string;
  custom_blog_limit: number;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id: string | null;
  feeds: FeedName[];
  date_found: string;
  time_found: string | null;
  community: string | null;
  source: string | null;
  post_title: string | null;
  author: string | null;
  post_url: string | null;
  post_body: string | null;
  group_url: string | null;
  intent_tier: IntentTier | null;
  primary_intent: string | null;
  key_question: string | null;
  reason_selected: string | null;
  drafted_response: string | null;
  draft_blocked_reason: string | null;
  response_status: ResponseStatus;
  response_link: string | null;
  followup_status: FollowupStatus;
  notes: string | null;
  detected_state: DetectedStateValue | null;
  claimed_by: string | null;
  claimed_at: string | null;
  claimed_draft: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadInsert = Omit<
  Lead,
  "id" | "created_at" | "updated_at" | "response_status" | "followup_status" | "feeds" | "claimed_by" | "claimed_at" | "claimed_draft" | "post_body" | "group_url" | "draft_blocked_reason"
> & {
  post_body?: string | null;
  group_url?: string | null;
  draft_blocked_reason?: string | null;
  response_status?: ResponseStatus;
  followup_status?: FollowupStatus;
  feeds?: FeedName[]; // DB default is '{lo}'
  claimed_by?: string | null;
  claimed_at?: string | null;
  claimed_draft?: string | null;
};

export type FbGroupStatus = "joined" | "candidate" | "ignored";
export type FbGroupSource = "capture" | "suggested" | "manual";

export interface FbGroup {
  id: string;
  user_id: string;
  group_name: string;
  group_url: string | null;
  status: FbGroupStatus;
  source: FbGroupSource;
  why: string | null;
  last_capture_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BlogPostStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  author_id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  topic: string;
  content_md: string;
  is_custom: boolean;
  status: BlogPostStatus;
  published_at: string | null;
  // Video posts: video_id set (11-char YouTube ID) marks a post as a video
  // post; text posts leave all three null.
  video_provider: "youtube" | null;
  video_id: string | null;
  transcript: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoutResult {
  post_url: string;
  post_title: string;
  author: string;
  community: string;
  source: string;
  body: string;
  posted_at: string;
}
