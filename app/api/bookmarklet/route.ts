import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { classifyTier, draftResponse } from "@/lib/drafter";
import type { LeadInsert } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface BookmarkletPayload {
  community: string;       // "Facebook", "NextDoor", "Quora", "LinkedIn", "Manual"
  source: string;          // group name / topic / sub
  post_title: string;
  post_url: string;
  author: string;
  body: string;
}

// CORS — the bookmarklet runs in a third-party page (facebook.com, nextdoor.com, etc.)
// and POSTs to this endpoint, so we have to allow cross-origin.
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
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

  if (!payload.post_url || !payload.post_title) {
    return NextResponse.json(
      { error: "post_url and post_title are required" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const supabase = supabaseAdmin();

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

  const tier = classifyTier(`${payload.post_title}\n${payload.body}`) || "TIER 2";

  let draft = {
    primary_intent: "Manual capture",
    key_question: payload.post_title,
    reason_selected: "Captured via bookmarklet.",
    drafted_response: ""
  };
  try {
    draft = await draftResponse({
      community: payload.community,
      source: payload.source,
      post_title: payload.post_title,
      author: payload.author || "Unknown",
      body: payload.body,
      intent_tier: tier
    });
  } catch (err) {
    console.warn("[bookmarklet] draft failed:", err);
  }

  const now = new Date();
  const lead: LeadInsert = {
    user_id: null,
    date_found: now.toISOString().slice(0, 10),
    time_found: now.toISOString().slice(11, 16) + " UTC",
    community: payload.community,
    source: payload.source,
    post_title: payload.post_title,
    author: payload.author || "Unknown",
    post_url: payload.post_url,
    intent_tier: tier,
    primary_intent: draft.primary_intent,
    key_question: draft.key_question,
    reason_selected: draft.reason_selected,
    drafted_response: draft.drafted_response,
    response_link: null,
    notes: "Captured via bookmarklet."
  };

  const { data, error } = await supabase.from("leads").insert(lead).select("id").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
  return NextResponse.json(
    { status: "inserted", id: data.id, tier },
    { status: 200, headers: corsHeaders() }
  );
}
