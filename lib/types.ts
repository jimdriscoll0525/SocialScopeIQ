export type IntentTier = "TIER 1" | "TIER 2" | "TIER 3";
export type ResponseStatus = "DRAFT" | "POSTED" | "REPLIED" | "ENGAGED" | "IGNORED";
export type FollowupStatus = "NOT STARTED" | "IN PROGRESS" | "DONE";
export type DetectedStateValue = "MA" | "NH" | "RI" | "NJ" | "ME" | "CT" | "FL" | "UNKNOWN" | "OUT_OF_STATE";

export interface Lead {
  id: string;
  user_id: string | null;
  date_found: string;
  time_found: string | null;
  community: string | null;
  source: string | null;
  post_title: string | null;
  author: string | null;
  post_url: string | null;
  intent_tier: IntentTier | null;
  primary_intent: string | null;
  key_question: string | null;
  reason_selected: string | null;
  drafted_response: string | null;
  response_status: ResponseStatus;
  response_link: string | null;
  followup_status: FollowupStatus;
  notes: string | null;
  detected_state: DetectedStateValue | null;
  created_at: string;
  updated_at: string;
}

export type LeadInsert = Omit<Lead, "id" | "created_at" | "updated_at" | "response_status" | "followup_status"> & {
  response_status?: ResponseStatus;
  followup_status?: FollowupStatus;
};

export interface ScoutResult {
  post_url: string;
  post_title: string;
  author: string;
  community: string;
  source: string;
  body: string;
  posted_at: string;
}
