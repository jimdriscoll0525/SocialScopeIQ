// One-off test: draft with the DB profile (same path the scout/claim flow uses).
// Run with: npx tsx scripts/test-drafter.ts
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

import { buildDrafterProfile, draftResponse } from "../lib/drafter";
import type { Profile } from "../lib/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const ownerId = process.env.OWNER_USER_ID!;
  const { data: row, error } = await supabase.from("profiles").select("*").eq("id", ownerId).single();
  if (error || !row) throw new Error("profile not found: " + error?.message);
  const profile = buildDrafterProfile(row as Profile);
  console.log("Drafting as:", profile.firstName, profile.lastName, "| company:", (profile as any).company, "| nmls:", (profile as any).nmls);

  const bpPost = {
    community: "BiggerPockets",
    source: "Mortgage Brokers & Lenders",
    post_title: "Can I use a DSCR loan on a non-warrantable condo?",
    author: "Test Poster",
    body: "Found a condo in Salem MA that cash flows great but my lender says the building is non-warrantable (40% investor owned, litigation pending). Is DSCR my only option? What LTV should I expect?",
    intent_tier: "TIER 1"
  };

  const redditPost = {
    community: "Reddit",
    source: "r/FirstTimeHomeBuyer",
    post_title: "620 credit score, is FHA my only option?",
    author: "throwaway123",
    body: "I make 70k, have about 15k saved, credit is 620 because of some old collections. Everyone says FHA but the MI seems brutal. Do I have other options or should I wait and build credit?",
    intent_tier: "TIER 2"
  };

  console.log("\n================ BIGGERPOCKETS DRAFT ================\n");
  const bp = await draftResponse(bpPost, profile);
  console.log(bp.drafted_response);

  console.log("\n================ REDDIT DRAFT ================\n");
  const rd = await draftResponse(redditPost, profile);
  console.log(rd.drafted_response);
}

main().catch((e) => { console.error(e); process.exit(1); });
