import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { classifyTier, draftResponse, buildDrafterProfile } from "@/lib/drafter";
import { detectState } from "@/lib/state-filter";
import type { LeadInsert, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface BookmarkletPayload {
  token: string;           // per-user capture token (bookmarklet_tokens)
  community: string;       // "Facebook", "NextDoor", "Quora", "LinkedIn", "Manual"
  source: string;          // group name / topic / sub
  post_title: string;
  post_url: string;
  author: string;
  body: string;
  group_url?: string;      // Facebook group URL, when captured inside a group
  group_name?: string;     // Facebook group name (used by Group Map inference, Phase 4)
}

// CORS — the bookmarklet runs in a third-party page (facebook.com, nextdoor.com, etc.)
// and POSTs to this endpoint, so we have to allow cross-origin. Session cookies
// do NOT ride along cross-site, which is why auth is a per-user token in the
// payload instead.
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  let payload: BookmarkletPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400, headers: corsHeaders() });
  }

  const supabase = supabaseAdmin();

  // Resolve the capture token to a user + profile. 401 with a hint the
  // bookmarklet alert() surfaces, so stale bookmarklets tell the user how to fix.
  if (!payload.token) {
    return NextResponse.json(
      { error: "missing token — re-drag the bookmarklet from the /bookmarklet page" },
      { status: 401, headers: corsHeaders() }
    );
  }
  const { data: tokenRow } = await supabase
    .from("bookmarklet_tokens")
    .select("user_id")
    .eq("token", payload.token)
    .maybeSingle();
  if (!tokenRow) {
    return NextResponse.json(
      { error: "invalid token — re-drag the bookmarklet from the /bookmarklet page" },
      { status: 401, headers: corsHeaders() }
    );
  }
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", tokenRow.user_id)
    .maybeSingle();
  if (!profileRow) {
    return NextResponse.json(
      { error: "no profile for token — finish onboarding first" },
      { status: 401, headers: corsHeaders() }
    );
  }
  const profile = profileRow as Profile;
  const isRealtor = profile.role === "realtor";

  if (!payload.post_url || !payload.post_title) {
    return NextResponse.json(
      { error: "post_url and post_title are required" },
      { status: 400, headers: corsHeaders() }
    );
  }

  // Idempotency — same URL captured twice just returns the existing row.
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("post_url", payload.post_url)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { status: "exists", id: existing.id },
      { status: 200, headers: corsHeaders() }
    );
  }

  // Manual captures always insert: the user already judged it a lead.
  // LO captures use the regex tiers; realtor captures default to TIER 2.
  const tier = isRealtor
    ? ("TIER 2" as const)
    : classifyTier(`${payload.post_title}\n${payload.body}`) || ("TIER 2" as const);

  let draft = {
    primary_intent: "Manual capture",
    key_question: payload.post_title,
    reason_selected: "Captured via bookmarklet.",
    drafted_response: ""
  };
  try {
    draft = await draftResponse(
      {
        community: payload.community,
        source: payload.source,
        post_title: payload.post_title,
        author: payload.author || "Unknown",
        body: payload.body,
        intent_tier: tier
      },
      buildDrafterProfile(profile)
    );
  } catch (err) {
    console.warn("[bookmarklet] draft failed:", err);
  }

  const now = new Date();
  const lead: LeadInsert = {
    user_id: profile.id,
    feeds: isRealtor ? ["realtor"] : ["lo"],
    date_found: now.toISOString().slice(0, 10),
    time_found: now.toISOString().slice(11, 16) + " UTC",
    community: payload.community,
    source: payload.source,
    post_title: payload.post_title,
    author: payload.author || "Unknown",
    post_url: payload.post_url,
    post_body: (payload.body || "").slice(0, 4000),
    group_url: payload.group_url || null,
    intent_tier: tier,
    primary_intent: draft.primary_intent,
    key_question: draft.key_question,
    reason_selected: draft.reason_selected,
    // Role decides which draft column the response lives in: realtors work
    // out of claimed_draft (their personalized draft), LOs out of
    // drafted_response. Realtor captures are auto-claimed by the capturer so
    // they land in their dashboard, not the shared pool.
    drafted_response: isRealtor ? "" : draft.drafted_response,
    claimed_by: isRealtor ? profile.id : null,
    claimed_at: isRealtor ? now.toISOString() : null,
    claimed_draft: isRealtor ? draft.drafted_response : null,
    response_link: null,
    notes: "Captured via bookmarklet.",
    detected_state: detectState({
      text: `${payload.post_title}\n${payload.body}`,
      community: payload.community,
      source: payload.source
    }).state
  };

  const { data, error } = await supabase.from("leads").insert(lead).select("id").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  // Group Map: capturing from inside a Facebook group proves membership, so
  // auto-mark it joined. Never fails the capture.
  if (payload.group_url || payload.group_name) {
    const groupName = (payload.group_name || payload.source || "").trim().slice(0, 200);
    if (groupName) {
      const { error: groupErr } = await supabase.from("fb_groups").upsert(
        {
          user_id: profile.id,
          group_name: groupName,
          group_url: payload.group_url || null,
          status: "joined",
          source: "capture",
          last_capture_at: now.toISOString()
        },
        { onConflict: "user_id,group_name" }
      );
      if (groupErr) console.warn("[bookmarklet] fb_groups upsert failed:", groupErr.message);
    }
  }

  return NextResponse.json(
    { status: "inserted", id: data.id, tier },
    { status: 200, headers: corsHeaders() }
  );
}
