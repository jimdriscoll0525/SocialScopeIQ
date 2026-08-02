"use server";

import { getSessionUser } from "@/lib/supabase/server";
import { buildDrafterProfile, draftResponse } from "@/lib/drafter";
import type { Lead, Profile } from "@/lib/types";

export type ClaimResult =
  | { ok: true; claimed_by: string; claimed_at: string; claimed_draft: string | null }
  | { ok: false; reason: "already_claimed" | string };

// Claim a realtor lead. The conditional update (.is("claimed_by", null)) is
// the concurrency guard: if two realtors race, exactly one update matches and
// the loser gets zero rows back.
//
// After a successful claim, an AI draft is generated in the CLAIMER's voice
// and stored in claimed_draft. Draft failures never fail the claim — the
// realtor keeps the lead and can write by hand (or edit later).
export async function claimLead(id: string): Promise<ClaimResult> {
  const { supabase, user } = await getSessionUser();
  if (!user) return { ok: false, reason: "Not signed in." };

  const claimedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("leads")
    .update({ claimed_by: user.id, claimed_at: claimedAt })
    .eq("id", id)
    .is("claimed_by", null)
    .select("id");

  if (error) return { ok: false, reason: error.message };
  if (!data || data.length === 0) return { ok: false, reason: "already_claimed" };

  let claimedDraft: string | null = null;
  try {
    const [{ data: leadRow }, { data: profileRow }] = await Promise.all([
      supabase.from("leads").select("*").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
    ]);
    const lead = leadRow as Lead | null;

    if (lead && profileRow && !lead.claimed_draft) {
      const draft = await draftResponse(
        {
          community: lead.community || "",
          source: lead.source || "",
          post_title: lead.post_title || "",
          author: lead.author || "Unknown",
          body: lead.post_body || lead.key_question || lead.post_title || "",
          intent_tier: lead.intent_tier || "TIER 2"
        },
        buildDrafterProfile(profileRow as Profile)
      );
      claimedDraft = draft.drafted_response;
      await supabase.from("leads").update({ claimed_draft: claimedDraft }).eq("id", id);
    } else if (lead?.claimed_draft) {
      claimedDraft = lead.claimed_draft;
    }
  } catch (err) {
    console.warn("[claimLead] draft-on-claim failed (claim still succeeded):", err);
  }

  return { ok: true, claimed_by: user.id, claimed_at: claimedAt, claimed_draft: claimedDraft };
}
