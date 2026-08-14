// Regenerates unposted Reddit + BiggerPockets reply drafts through the NEW
// discussion-style drafting prompt (one point only, randomized length,
// react-to-thread). Blog posts are untouched (different table entirely).
//
// Trial run (3 newest drafts, prints full before/after):
//   npm run regen-drafts -- --limit 3
// Full run:
//   npm run regen-drafts
//
// What it does per lead:
// - Only leads with response_status = 'DRAFT' (POSTED/REPLIED/ENGAGED are
//   skipped; IGNORED/DELETED are dead and also skipped).
// - Re-drafts drafted_response (owner/scout persona) and, where present,
//   claimed_draft (the claiming realtor's persona) from the stored
//   post_body + post_comments.
// - Overwrites ONLY the draft text and draft_blocked_reason. Record id,
//   thread link, platform, tier, state, notes, claim data all stay put.
// - Leads whose post_body is missing are flagged and skipped (regenerate or
//   delete those manually).
//
// Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
// ANTHROPIC_API_KEY in .env.local. OWNER_USER_ID selects the scout persona
// (falls back to the built-in Jim persona).

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import {
  buildDrafterProfile,
  draftResponse,
  JIM_FALLBACK_PROFILE,
  type DrafterProfile
} from "../lib/drafter";
import type { Lead, Profile } from "../lib/types";

// Load .env.local manually (no dotenv dep).
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : null;
if (limitArg !== -1 && (!Number.isFinite(LIMIT) || LIMIT! < 1)) {
  console.error("--limit needs a positive number, e.g. --limit 3");
  process.exit(1);
}
// --skip <id,id,...> — leads to leave untouched (e.g. trial drafts already
// regenerated and approved; a re-run would overwrite them with new versions).
const skipArg = process.argv.indexOf("--skip");
const SKIP_IDS = new Set(
  skipArg !== -1 ? (process.argv[skipArg + 1] || "").split(",").map((s) => s.trim()).filter(Boolean) : []
);
// Print full before/after text on small runs (the trial), counts only on big ones.
const SHOW_TEXT = LIMIT !== null && LIMIT <= 5;

async function getOwnerProfile(): Promise<DrafterProfile> {
  const ownerId = process.env.OWNER_USER_ID;
  if (ownerId) {
    const { data } = await supabase.from("profiles").select("*").eq("id", ownerId).maybeSingle();
    if (data) return buildDrafterProfile(data as Profile);
    console.warn(`OWNER_USER_ID=${ownerId} has no profiles row — using fallback persona`);
  }
  return JIM_FALLBACK_PROFILE;
}

const profileCache = new Map<string, DrafterProfile | null>();
async function getClaimerProfile(userId: string): Promise<DrafterProfile | null> {
  if (profileCache.has(userId)) return profileCache.get(userId)!;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  const p = data ? buildDrafterProfile(data as Profile) : null;
  profileCache.set(userId, p);
  return p;
}

function divider(label: string) {
  console.log(`\n${"=".repeat(76)}\n${label}\n${"=".repeat(76)}`);
}

async function main() {
  // Unposted Reddit/BP leads. Community/source matched loosely because the
  // scouts and the bookmarklet label them slightly differently.
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("response_status", "DRAFT")
    .or(
      "community.ilike.%reddit%,community.ilike.%biggerpockets%,source.ilike.%reddit%,source.ilike.%biggerpockets%"
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load leads:", error.message);
    process.exit(1);
  }

  const all = (data || []) as Lead[];
  // Realtor-only leads with no draft yet regenerate at claim time — skip.
  const withDrafts = all.filter(
    (l) => l.drafted_response?.trim() || l.claimed_draft?.trim()
  );
  const missingBody = withDrafts.filter((l) => !l.post_body?.trim());
  const candidates = withDrafts.filter((l) => l.post_body?.trim() && !SKIP_IDS.has(l.id));
  const toProcess = LIMIT !== null ? candidates.slice(0, LIMIT) : candidates;
  if (SKIP_IDS.size > 0) console.log(`  skipped via --skip: ${SKIP_IDS.size}`);

  console.log(`Unposted Reddit/BP leads: ${all.length}`);
  console.log(`  with a draft to regenerate: ${withDrafts.length}`);
  console.log(`  skipped (no stored post_body — fix manually): ${missingBody.length}`);
  console.log(`  processing this run: ${toProcess.length}${LIMIT !== null ? ` (--limit ${LIMIT})` : ""}`);

  const ownerProfile = await getOwnerProfile();

  let regenerated = 0;
  let blocked = 0;
  const failures: { id: string; title: string; error: string }[] = [];

  for (const lead of toProcess) {
    const req = {
      community: lead.community || "",
      source: lead.source || "",
      post_title: lead.post_title || "",
      author: lead.author || "Unknown",
      body: lead.post_body!,
      intent_tier: lead.intent_tier || ("TIER 2" as const),
      comments: lead.post_comments
    };

    try {
      const update: Record<string, unknown> = {};
      let blockedReason: string | null = null;

      if (lead.drafted_response?.trim()) {
        const draft = await draftResponse(req, ownerProfile);
        update.drafted_response = draft.drafted_response;
        blockedReason = draft.blocked_reason;
        if (SHOW_TEXT) {
          divider(`${lead.community} | ${lead.post_title} (${lead.id})\n${lead.post_url || ""}`);
          console.log("--- BEFORE ---\n" + lead.drafted_response);
          console.log("\n--- AFTER ---\n" + draft.drafted_response);
          if (draft.blocked_reason) console.log(`\n[BLOCKED by sanitizer: ${draft.blocked_reason}]`);
        }
      }

      if (lead.claimed_draft?.trim() && lead.claimed_by) {
        const claimer = await getClaimerProfile(lead.claimed_by);
        if (claimer) {
          const draft = await draftResponse(req, claimer);
          update.claimed_draft = draft.drafted_response;
          blockedReason = blockedReason || draft.blocked_reason;
          if (SHOW_TEXT) {
            divider(`CLAIMED DRAFT | ${lead.post_title} (${lead.id})`);
            console.log("--- BEFORE ---\n" + lead.claimed_draft);
            console.log("\n--- AFTER ---\n" + draft.drafted_response);
          }
        } else {
          console.warn(`  claimed_draft on ${lead.id} kept as-is (claimer profile ${lead.claimed_by} not found)`);
        }
      }

      if (Object.keys(update).length === 0) continue;
      update.draft_blocked_reason = blockedReason;

      const { error: upErr } = await supabase.from("leads").update(update).eq("id", lead.id);
      if (upErr) {
        failures.push({ id: lead.id, title: lead.post_title || "", error: upErr.message });
        continue;
      }
      regenerated++;
      if (blockedReason) blocked++;
      if (!SHOW_TEXT) console.log(`  regenerated: ${lead.community} | ${lead.post_title}`);
    } catch (err) {
      failures.push({
        id: lead.id,
        title: lead.post_title || "",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  divider("SUMMARY");
  console.log(`Regenerated: ${regenerated} of ${toProcess.length} attempted`);
  console.log(`Flagged by compliance sanitizer (review before posting): ${blocked}`);
  if (missingBody.length > 0) {
    console.log(`\nSkipped — no stored thread content (regenerate or delete manually):`);
    for (const l of missingBody) {
      console.log(`  - [${l.id}] ${l.community} | ${l.post_title}\n    ${l.post_url || "(no url)"}`);
    }
  }
  if (failures.length > 0) {
    console.log(`\nFailures:`);
    for (const f of failures) console.log(`  - [${f.id}] ${f.title}: ${f.error}`);
  }
  if (LIMIT !== null && candidates.length > toProcess.length) {
    console.log(
      `\nTrial run only — ${candidates.length - toProcess.length} drafts remain. ` +
        "Run `npm run regen-drafts` (no --limit) to process the rest."
    );
  }
}

main();
