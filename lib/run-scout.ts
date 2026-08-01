import { supabaseAdmin } from "@/lib/supabase";
import { scoutReddit } from "@/lib/scouts/reddit";
import { scoutBiggerPockets } from "@/lib/scouts/biggerpockets";
import { scoutStackExchange } from "@/lib/scouts/stackexchange";
import { classifyTier, draftResponse } from "@/lib/drafter";
import { detectState, shouldKeepLead } from "@/lib/state-filter";
import type { LeadInsert, ScoutResult } from "@/lib/types";

// Cap on auto-drafted leads per run, to keep API costs bounded.
// Raised 10 -> 20 in Aug 2026 when the subreddit list and tier patterns were
// broadened and out-of-state leads started being kept (for referral to
// partner LOs); each draft is a single Sonnet call (a few cents).
const MAX_DRAFTS = 20;

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
  errors: { url: string; error: string }[];
}

// The full scout pipeline. Called by BOTH the cron route (/api/scout) and
// the dashboard "Find new posts" button (via the triggerScout server
// action). Kept pure and guard-free so the daily cron is never throttled —
// the manual-trigger in-flight/cooldown guards live in app/actions.ts.
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

  // 2. Filter to ones the keyword classifier matches.
  const tiered = candidates
    .map((c) => ({ ...c, intent_tier: classifyTier(`${c.post_title}\n${c.body}`) }))
    .filter((c): c is ScoutResult & { intent_tier: NonNullable<ReturnType<typeof classifyTier>> } => c.intent_tier !== null);

  // 2a. State detection — tag every lead; nothing is dropped anymore
  // (out-of-state leads are kept for referral to partner LOs and ranked
  // last below, so they only consume draft slots licensed leads don't need).
  const stateFiltered = tiered
    .map((t) => ({ ...t, state_result: detectState({ text: `${t.post_title}\n${t.body}`, community: t.community, source: t.source }) }))
    .filter((t) => shouldKeepLead(t.state_result));
  const oosKept = stateFiltered.filter((t) => t.state_result.state === "OUT_OF_STATE").length;

  // 3. De-duplicate against the DB (skip URLs we've already saved).
  const urls = stateFiltered.map((t) => t.post_url);
  const { data: existing } = await supabase
    .from("leads")
    .select("post_url")
    .in("post_url", urls);
  const existingSet = new Set((existing || []).map((r) => r.post_url));
  const fresh = stateFiltered.filter((t) => !existingSet.has(t.post_url));

  // 4. Rank: licensed states first, unknown-state next, out-of-state last
  // (referral candidates), with tier order within each group. Capped to
  // MAX_DRAFTS, so OOS leads only get slots licensed leads don't fill.
  const tierOrder = { "TIER 1": 0, "TIER 2": 1, "TIER 3": 2 } as const;
  const statePriority = (s: string) => (s === "OUT_OF_STATE" ? 2 : s === "UNKNOWN" ? 1 : 0);
  fresh.sort((a, b) => {
    const sp = statePriority(a.state_result.state) - statePriority(b.state_result.state);
    if (sp !== 0) return sp;
    return tierOrder[a.intent_tier] - tierOrder[b.intent_tier];
  });
  const toDraft = fresh.slice(0, MAX_DRAFTS);

  // 5. Draft responses (Anthropic API) and insert.
  let inserted = 0;
  const errors: { url: string; error: string }[] = [];

  for (const c of toDraft) {
    try {
      const draft = await draftResponse({
        community: c.community,
        source: c.source,
        post_title: c.post_title,
        author: c.author,
        body: c.body,
        intent_tier: c.intent_tier
      });

      const now = new Date();
      const lead: LeadInsert = {
        user_id: null,
        date_found: now.toISOString().slice(0, 10),
        time_found: now.toISOString().slice(11, 16) + " UTC",
        community: c.community,
        source: c.source,
        post_title: c.post_title,
        author: c.author,
        post_url: c.post_url,
        intent_tier: c.intent_tier,
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
      else inserted++;
    } catch (err) {
      errors.push({ url: c.post_url, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    sources: {
      reddit: reddit.status === "fulfilled" ? reddit.value.length : `error: ${(reddit as PromiseRejectedResult).reason}`,
      biggerpockets: bp.status === "fulfilled" ? bp.value.length : `error: ${(bp as PromiseRejectedResult).reason}`,
      stackexchange: se.status === "fulfilled" ? se.value.length : `error: ${(se as PromiseRejectedResult).reason}`
    },
    matched: tiered.length,
    oos_kept: oosKept,
    fresh: fresh.length,
    drafted: toDraft.length,
    inserted,
    errors
  };
}
