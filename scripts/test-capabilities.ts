// Products & Capabilities drafting test.
// Run with: npx tsx scripts/test-capabilities.ts
// Expects migration 007 applied and the LO profile seeded.
//
// 1a/1b. Rental-property HELOC ask (BiggerPockets + Reddit) — should mention
//        the investment-property equity line capability; Reddit contact-free.
// 2.     Self-employed equity without tax returns (Reddit) — should mention
//        bank statement equity lines.
// 3.     Generic first-time buyer question (Reddit) — no capability mention.
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

const CONTACT_PATTERNS = [
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, // phone
  /@\w+\.(com|net|org)/i, // email
  /https?:\/\//i, // url
  /mortgage equity partners/i, // company
  /nmls/i
];

function check(label: string, draft: string, expectCapability: RegExp | null, expectNoContact: boolean) {
  const problems: string[] = [];
  if (expectCapability && !expectCapability.test(draft)) {
    problems.push(`MISSING expected capability mention (${expectCapability})`);
  }
  if (expectCapability === null) {
    const capabilityTells = /bank statement equity|dscr equity|chenoa|cash offer program|no-contingency program|land loan/i;
    if (capabilityTells.test(draft)) problems.push("mentioned a capability on a post that didn't call for one");
  }
  if (expectNoContact) {
    for (const p of CONTACT_PATTERNS) {
      if (p.test(draft)) problems.push(`CONTACT INFO leaked (${p})`);
    }
  }
  console.log(`\n======== ${label}: ${problems.length === 0 ? "PASS" : "FAIL " + problems.join("; ")} ========\n`);
  console.log(draft);
}

async function main() {
  const { data: row, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", process.env.OWNER_USER_ID!)
    .single();
  if (error || !row) throw new Error("profile not found: " + error?.message);
  const profile = buildDrafterProfile(row as Profile);
  if (!profile.productsCapabilities) {
    throw new Error("products_capabilities is empty — run migration 007 first");
  }
  console.log("Capabilities loaded:", profile.productsCapabilities.split("\n").length, "lines");

  const helocPost = {
    post_title: "HELOC on a rental property - does anyone actually offer these?",
    author: "Test Investor",
    body: "I own a duplex free and clear and want to tap the equity for my next purchase without refinancing (my first mortgage is at 3.1%). Every bank I call says they only do HELOCs on primary residences. Is an equity line on an investment property even a thing?",
    intent_tier: "TIER 1" as const
  };

  const [d1a, d1b, d2, d3] = await Promise.all([
    draftResponse({ ...helocPost, community: "BiggerPockets", source: "Private & Conventional Lending" }, profile),
    draftResponse({ ...helocPost, community: "Reddit", source: "r/RealEstateInvesting" }, profile),
    draftResponse(
      {
        community: "Reddit",
        source: "r/Mortgages",
        post_title: "Self-employed, tons of equity, no tax returns that look good - stuck?",
        author: "Test SelfEmployed",
        body: "I write everything off, so my tax returns show almost no income even though my business deposits are strong. I have $400k of equity in my house and need about $80k for a renovation. Banks keep telling me no based on my returns. Do I have any options that don't require tax returns?",
        intent_tier: "TIER 1" as const
      },
      profile
    ),
    draftResponse(
      {
        community: "Reddit",
        source: "r/FirstTimeHomeBuyer",
        post_title: "What order do I do things in?",
        author: "Test FTB",
        body: "Total newbie here. Do I find a house first, get pre-approved first, find an agent first? What does the timeline look like from deciding to buy to getting keys?",
        intent_tier: "TIER 3" as const
      },
      profile
    )
  ]);

  check("1a HELOC/rental (BiggerPockets)", d1a.drafted_response, /equity line|heloc/i, false);
  check("1b HELOC/rental (Reddit, contact-free)", d1b.drafted_response, /equity line|heloc/i, true);
  check("2 bank-statement equity (Reddit)", d2.drafted_response, /bank statement/i, true);
  check("3 generic FTHB (no capability expected)", d3.drafted_response, null, true);
}

main().catch((e) => { console.error(e); process.exit(1); });
