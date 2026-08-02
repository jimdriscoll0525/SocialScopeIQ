import { supabaseAdmin } from "@/lib/supabase";
import { scoutReddit } from "@/lib/scouts/reddit";
import { scoutBiggerPockets } from "@/lib/scouts/biggerpockets";
import { scoutStackExchange } from "@/lib/scouts/stackexchange";
import {
  classifyTier,
  draftResponse,
  buildDrafterProfile,
  JIM_FALLBACK_PROFILE,
  type DrafterProfile
} from "@/lib/drafter";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import { detectState, shouldKeepLead } from "@/lib/state-filter";
import {
  passesRealtorPrefilter,
  classifyRealtorLead,
  realtorCategoryTier,
  realtorCategoryLabel
} from "@/lib/realtor-classifier";
import type { FeedName, LeadInsert, ScoutResult } from "@/lib/types";

// Cap on auto-drafted leads per run, to keep API costs bounded.
// Raised 10 -> 20 in Aug 2026 when the subreddit list and tier patterns were
// broadened and out-of-state leads started being kept (for referral to
// partner LOs); each draft is a single Sonnet call (a few cents).
const MAX_DRAFTS = 20;

// Cap on realtor classification calls per run (one small Haiku call each —
// pennies, but bound it anyway). Realtor candidates are already gated hard:
// detected state must be MA/NH and the prefilter regex must match.
const MAX_REALTOR_CLASSIFY = 50;

// Small parallel batches for the classification calls.
const CLASSIFY_BATCH = 5;

// The persona the scout drafts LO responses in: the owner's profile
// (OWNER_USER_ID env), falling back to the hardcoded Jim persona so the daily
// cron never breaks on a missing/unreadable profile.
async function getOwnerProfile(supabase: SupabaseClient): Promise<DrafterProfile> {
  const ownerId = process.env.OWNER_USER_ID;
  if (ownerId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", ownerId)
      .maybeSingle();
    if (data) return buildDrafterProfile(data as Profile);
    console.warn(`[scout] OWNER_USER_ID=${ownerId} has no profiles row — using fallback persona`);
  }
  return JIM_FALLBACK_PROFILE;
}

export interface ScoutSummary {
  sources: {
    reddit: number | string;
    biggerpockets: number | string;
    stackexchange: number | string;
  };
  matched: number;
  oos_kept: number;
  fresh: number;
  drafted: number;
  inserted: number;
  realtor_classified: number;
  realtor_matched: number;
  realtor_inserted: number;
  errors: { url: string; error: string }[];
}

// The full scout pipeline. Called by BOTH the cron route (/api/scout) and
// the dashboard "Find new posts" button (via the triggerScout server
// action). Kept pure and guard-free so the daily cron is never throttled —
// the manual-trigger in-flight/cooldown guards live in app/actions.ts.
//
// Two feeds come out of one scrape:
// - LO feed: the original regex classifyTier() path, byte-for-byte unchanged
//   (rank by state priority + tier, draft up to MAX_DRAFTS, insert).
// - Realtor feed: MA/NH posts that pass the prefilter get one cheap AI
//   classification; relevant ones are inserted UNDRAFTED (drafting happens at
//   claim time, in the claiming realtor's voice).
// A post can be in both feeds (feeds = {lo,realtor}).
export async function runScout(): Promise<ScoutSummary> {
  const supabase = supabaseAdmin();

  // 1. Pull raw posts from every source.
  const [reddit, bp, se] = await Promise.allSettled([
    scoutReddit(),
    scoutBiggerPockets(),
    scoutStackExchange()
  ]);
  const candidates: ScoutResult[] = [
    ...(reddit.status === "fulfilled" ? reddit.value : []),
    ...(bp.status === "fulfilled" ? bp.value : []),
    ...(se.status === "fulfilled" ? se.value : [])
  ];

  // 2. Tag every candidate: LO tier (regex) + detected state.
  const tagged = candidates.map((c) => ({
    ...c,
    intent_tier: classifyTier(`${c.post_title}\n${c.body}`),
    state_result: detectState({
      text: `${c.post_title}\n${c.body}`,
      community: c.community,
      source: c.source
    })
  }));

  // 2a. Realtor eligibility gate (before any AI spend): identifiably MA or NH
  // — posts with no location are excluded from the realtor feed — plus a
  // broad topical prefilter.
  const isRealtorEligible = (t: (typeof tagged)[number]) =>
    (t.state_result.state === "MA" || t.state_result.state === "NH") &&
    passesRealtorPrefilter(`${t.post_title}\n${t.body}`);

  // Keep anything that could enter either feed.
  const kept = tagged
    .filter((t) => shouldKeepLead(t.state_result))
    .filter((t) => t.intent_tier !== null || isRealtorEligible(t));
  const loMatched = kept.filter((t) => t.intent_tier !== null);
  const oosKept = loMatched.filter((t) => t.state_result.state === "OUT_OF_STATE").length;

  // 3. De-duplicate against the DB (skip URLs we've already saved) BEFORE the
  // paid classification/drafting steps.
  const urls = kept.map((t) => t.post_url);
  const { data: existing } = await supabase
    .from("leads")
    .select("post_url")
    .in("post_url", urls);
  const existingSet = new Set((existing || []).map((r) => r.post_url));
  const fresh = kept.filter((t) => !existingSet.has(t.post_url));

  // 4. Realtor classification for fresh eligible posts (small parallel
  // batches, capped). null = not relevant (fail closed).
  const realtorCandidates = fresh.filter(isRealtorEligible).slice(0, MAX_REALTOR_CLASSIFY);
  const realtorResults = new Map<string, NonNullable<Awaited<ReturnType<typeof classifyRealtorLead>>>>();
  for (let i = 0; i < realtorCandidates.length; i += CLASSIFY_BATCH) {
    const batch = realtorCandidates.slice(i, i + CLASSIFY_BATCH);
    const settled = await Promise.all(
      batch.map((c) => classifyRealtorLead({ title: c.post_title, body: c.body }))
    );
    settled.forEach((res, j) => {
      if (res && res.relevant) realtorResults.set(batch[j].post_url, res);
    });
  }

  // 5. LO pipeline — unchanged: rank licensed-first then tier, cap, draft.
  const loFresh = fresh.filter((t) => t.intent_tier !== null);
  const tierOrder = { "TIER 1": 0, "TIER 2": 1, "TIER 3": 2 } as const;
  const statePriority = (s: string) => (s === "OUT_OF_STATE" ? 2 : s === "UNKNOWN" ? 1 : 0);
  loFresh.sort((a, b) => {
    const sp = statePriority(a.state_result.state) - statePriority(b.state_result.state);
    if (sp !== 0) return sp;
    return tierOrder[a.intent_tier!] - tierOrder[b.intent_tier!];
  });
  const toDraft = loFresh.slice(0, MAX_DRAFTS);
  const draftedUrls = new Set(toDraft.map((t) => t.post_url));

  let inserted = 0;
  let realtorInserted = 0;
  const errors: { url: string; error: string }[] = [];
  const ownerProfile = await getOwnerProfile(supabase);

  for (const c of toDraft) {
    try {
      const draft = await draftResponse(
        {
          community: c.community,
          source: c.source,
          post_title: c.post_title,
          author: c.author,
          body: c.body,
          intent_tier: c.intent_tier!
        },
        ownerProfile
      );

      const feeds: FeedName[] = realtorResults.has(c.post_url) ? ["lo", "realtor"] : ["lo"];
      const now = new Date();
      const lead: LeadInsert = {
        user_id: null,
        feeds,
        date_found: now.toISOString().slice(0, 10),
        time_found: now.toISOString().slice(11, 16) + " UTC",
        community: c.community,
        source: c.source,
        post_title: c.post_title,
        author: c.author,
        post_url: c.post_url,
        post_body: c.body.slice(0, 4000),
        intent_tier: c.intent_tier!,
        primary_intent: draft.primary_intent,
        key_question: draft.key_question,
        reason_selected: draft.reason_selected,
        drafted_response: draft.drafted_response,
        response_link: null,
        notes: null,
        detected_state: c.state_result.state
      };

      const { error } = await supabase.from("leads").insert(lead);
      if (error) errors.push({ url: c.post_url, error: error.message });
      else {
        inserted++;
        if (feeds.includes("realtor")) realtorInserted++;
      }
    } catch (err) {
      errors.push({ url: c.post_url, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // 6. Realtor-only inserts: relevant posts that did NOT go through the LO
  // draft path (either no LO tier, or they missed the MAX_DRAFTS cut — in
  // which case they enter as realtor-only so LO behavior stays unchanged).
  // No draft yet: claiming generates one in the claimer's voice.
  for (const c of fresh) {
    const cls = realtorResults.get(c.post_url);
    if (!cls || draftedUrls.has(c.post_url)) continue;

    const now = new Date();
    const lead: LeadInsert = {
      user_id: null,
      feeds: ["realtor"],
      date_found: now.toISOString().slice(0, 10),
      time_found: now.toISOString().slice(11, 16) + " UTC",
      community: c.community,
      source: c.source,
      post_title: c.post_title,
      author: c.author,
      post_url: c.post_url,
      post_body: c.body.slice(0, 4000),
      intent_tier: realtorCategoryTier(cls.category),
      primary_intent: realtorCategoryLabel(cls.category),
      key_question: c.post_title,
      reason_selected: `Realtor lead (${realtorCategoryLabel(cls.category).toLowerCase()}) in ${c.state_result.state}`,
      drafted_response: "",
      response_link: null,
      notes: null,
      detected_state: c.state_result.state
    };

    const { error } = await supabase.from("leads").insert(lead);
    if (error) errors.push({ url: c.post_url, error: error.message });
    else realtorInserted++;
  }

  return {
    sources: {
      reddit: reddit.status === "fulfilled" ? reddit.value.length : `error: ${(reddit as PromiseRejectedResult).reason}`,
      biggerpockets: bp.status === "fulfilled" ? bp.value.length : `error: ${(bp as PromiseRejectedResult).reason}`,
      stackexchange: se.status === "fulfilled" ? se.value.length : `error: ${(se as PromiseRejectedResult).reason}`
    },
    matched: loMatched.length,
    oos_kept: oosKept,
    fresh: fresh.length,
    drafted: toDraft.length,
    inserted,
    realtor_classified: realtorCandidates.length,
    realtor_matched: realtorResults.size,
    realtor_inserted: realtorInserted,
    errors
  };
}
