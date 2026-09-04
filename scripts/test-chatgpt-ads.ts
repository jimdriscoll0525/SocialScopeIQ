// ChatGPT Ads campaign generation test.
// Run with: npx tsx scripts/test-chatgpt-ads.ts [--realtor-only | --lo-only]
//
// Pure checks (no API): UTM tagging, brief formatting.
// Generation checks (ANTHROPIC_API_KEY; reads the LO + realtor profiles from
// Supabase with the service role, falls back to built-in personas):
//  1. LO refinance, Boston metro, MEP landing page — 4-6 distinct ad groups,
//     prompt-based targeting (example prompts, no demographics), conservative
//     compliant copy (no rates / guarantees / pre-approved), NMLS + Equal
//     Housing tail, correct UTM params per ad group.
//  2. LO HELOC campaign for investment property owners — copy reflects
//     investment-property HELOCs, bank statement equity lines, DSCR.
//  3. Realtor buyer-leads campaign — realtor objectives, no NMLS / Equal
//     Housing Lender / rate language, Fair Housing-safe targeting.
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

import { buildDrafterProfile, JIM_FALLBACK_PROFILE, type DrafterProfile } from "../lib/drafter";
import { chatgptAdsService, type GeneratedAdGroup } from "../lib/chatgpt-ads/service";
import { LO_OBJECTIVES, REALTOR_OBJECTIVES } from "../lib/chatgpt-ads/objectives";
import { withUtm, campaignSlug, adGroupSlug, adsManagerUrlParts } from "../lib/chatgpt-ads/utm";
import { formatFullBrief, formatAdGroupBlock, TITLE_MAX, DESCRIPTION_MAX } from "../lib/chatgpt-ads/format";
import type { Profile } from "../lib/types";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "  PASS" : "  FAIL"} ${label}${detail && !ok ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// ─── Pure checks ─────────────────────────────────────────────────────────────
console.log("\n== UTM + formatting ==");
{
  const url = withUtm("https://mortgageequitypartners.com/james-driscoll/?ref=x&utm_source=old", "Boston Metro Refinance", "Debt Consolidation");
  const u = new URL(url);
  check("utm_source", u.searchParams.get("utm_source") === "chatgpt_ads");
  check("utm_medium", u.searchParams.get("utm_medium") === "paid");
  check("utm_campaign slug", u.searchParams.get("utm_campaign") === "boston-metro-refinance", u.toString());
  check("utm_content slug", u.searchParams.get("utm_content") === "debt-consolidation", u.toString());
  check("non-utm params preserved", u.searchParams.get("ref") === "x");
  check("stale utm replaced", u.searchParams.getAll("utm_source").length === 1);
  check("idempotent", withUtm(url, "Boston Metro Refinance", "Debt Consolidation") === url);
  check("invalid url passthrough", withUtm("not a url", "a", "b") === "not a url");
  const brief = formatFullBrief(
    { name: "X", objective_label: "Refinance", target_market: "Boston", daily_budget: 25, bid_type: "cpc", landing_page_url: "https://a.b" },
    [{ name: "G1", audience_theme: "t", targeting_instructions: "ti", ad_headline: "h", ad_body: "b", ad_image_prompt: "ip", landing_page_url: "https://a.b/?x" }]
  );
  check("brief has campaign + group + split URL", brief.includes("Campaign name: X") && brief.includes("Ad group 1: G1") && brief.includes("Ad destination URL: https://a.b/?x") && brief.includes("Landing page query parameters: utm_term={ad_id}"));
  check("group block has title", formatAdGroupBlock({ name: "G", audience_theme: "", targeting_instructions: "", ad_headline: "HL", ad_body: "", ad_image_prompt: "", landing_page_url: "" }).includes(`Title (2/${TITLE_MAX}): HL`));
  const parts = adsManagerUrlParts("https://a.b/page?ref=x&utm_source=chatgpt_ads&utm_medium=paid&utm_campaign=c&utm_content=g");
  check("split: destination keeps non-utm params", parts.destination_url === "https://a.b/page?ref=x", parts.destination_url);
  check("split: query params literal braces", parts.query_parameters === "utm_source=chatgpt_ads&utm_medium=paid&utm_campaign=c&utm_content=g&utm_term={ad_id}", parts.query_parameters);
}

// ─── Generation checks ───────────────────────────────────────────────────────
const RATE_OR_GUARANTEE = /\b\d+(\.\d+)?\s?%|\bAPR\b|guarantee|pre-?approved|pre-?qualified|lowest rate|best rate|no closing costs|instant approval|act now|limited time/i;
const DEMOGRAPHIC = /\b(age[sd]? \d|\d{2}-\d{2} year|income (over|under|above|below)|race|ethnic|religio|hispanic|latino|asian|black|white|jewish|muslim|christian|families with children|single mothers|elderly|senior citizens|millennial|gen z|boomer)\b/i;

function assertGroups(label: string, groups: GeneratedAdGroup[], landing: string, campaignName: string) {
  check(`${label}: 4-6 ad groups (${groups.length})`, groups.length >= 4 && groups.length <= 6);
  const themes = new Set(groups.map((g) => g.audience_theme.toLowerCase()));
  check(`${label}: distinct themes`, themes.size === groups.length);
  for (const g of groups) {
    const tag = `${label} / ${g.name}`;
    check(`${tag}: title within ${TITLE_MAX} (${g.ad_headline.length})`, g.ad_headline.length > 0 && g.ad_headline.length <= TITLE_MAX, g.ad_headline);
    check(`${tag}: description within ${DESCRIPTION_MAX} (${g.ad_body.length})`, g.ad_body.length > 0 && g.ad_body.length <= DESCRIPTION_MAX, g.ad_body);
    const parts = adsManagerUrlParts(g.landing_page_url);
    check(`${tag}: Ads Manager URL split`, !/utm_/.test(parts.destination_url) && /utm_campaign=/.test(parts.query_parameters) && parts.query_parameters.includes("utm_term={ad_id}"), JSON.stringify(parts));
    check(`${tag}: targeting has example prompts`, /["“]/.test(g.targeting_instructions) && g.targeting_instructions.length > 150, g.targeting_instructions.slice(0, 120));
    check(`${tag}: targeting is not demographic`, !DEMOGRAPHIC.test(g.targeting_instructions), g.targeting_instructions.match(DEMOGRAPHIC)?.[0]);
    check(`${tag}: image prompt present`, g.ad_image_prompt.length > 20);
    const u = new URL(g.landing_page_url);
    check(`${tag}: utm params`, u.searchParams.get("utm_source") === "chatgpt_ads" && u.searchParams.get("utm_medium") === "paid" && u.searchParams.get("utm_campaign") === campaignSlug(campaignName) && u.searchParams.get("utm_content") === adGroupSlug(g.name), g.landing_page_url);
    check(`${tag}: lands on ${new URL(landing).host}`, u.host === new URL(landing).host);
  }
}

function assertLoCompliance(label: string, groups: GeneratedAdGroup[], nmls: string | null) {
  for (const g of groups) {
    const tag = `${label} / ${g.name}`;
    const copy = `${g.ad_headline} ${g.ad_body}`;
    check(`${tag}: no rates/guarantees/pre-approved`, !RATE_OR_GUARANTEE.test(copy), copy.match(RATE_OR_GUARANTEE)?.[0]);
    if (nmls) check(`${tag}: NMLS in body`, g.ad_body.includes(`NMLS #${nmls}`), g.ad_body);
    check(`${tag}: Equal Housing Lender`, /equal housing lender/i.test(g.ad_body), g.ad_body);
  }
}

function assertRealtorCompliance(label: string, groups: GeneratedAdGroup[]) {
  for (const g of groups) {
    const tag = `${label} / ${g.name}`;
    const all = `${g.ad_headline} ${g.ad_body} ${g.targeting_instructions}`;
    check(`${tag}: no NMLS`, !/nmls/i.test(all));
    check(`${tag}: no Equal Housing Lender`, !/equal housing lender/i.test(all));
    // Copy only: targeting may legitimately describe buyers asking ChatGPT
    // about pre-approval or rates — that's a topic to match, not ad copy.
    const copy = `${g.ad_headline} ${g.ad_body}`;
    check(`${tag}: no rate/APR/approval language in copy`, !/\bAPR\b|interest rate|loan approval|pre-?approv/i.test(copy), copy.match(/\bAPR\b|interest rate|loan approval|pre-?approv/i)?.[0]);
    check(`${tag}: Equal Housing Opportunity tail`, /equal housing opportunity/i.test(g.ad_body), g.ad_body);
    check(`${tag}: Fair Housing labels absent`, !/family-friendly|safe neighborhood|good schools|great schools|best schools/i.test(`${g.ad_headline} ${g.ad_body}`));
  }
}

function printGroups(groups: GeneratedAdGroup[]) {
  for (const g of groups) {
    console.log(`\n  [${g.name}] ${g.audience_theme}`);
    console.log(`    HEADLINE: ${g.ad_headline}`);
    console.log(`    BODY:     ${g.ad_body}`);
    console.log(`    URL:      ${g.landing_page_url}`);
    console.log(`    TARGET:   ${g.targeting_instructions.replace(/\s+/g, " ").slice(0, 260)}…`);
  }
}

async function loadProfiles(): Promise<{ lo: DrafterProfile; realtor: DrafterProfile }> {
  let lo: DrafterProfile = JIM_FALLBACK_PROFILE;
  let realtor: DrafterProfile = {
    ...JIM_FALLBACK_PROFILE,
    role: "realtor",
    company: null,
    nmls: null,
    brokerage: "Test Realty",
    productsCapabilities: "- Buyer representation in Lynnfield and the North Shore\n- Listing services with staging and pro photography",
    townsServed: ["Lynnfield"],
    statesServed: ["MA"]
  };
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data } = await sb.from("profiles").select("*");
    const loRow = (data || []).find((p) => p.role === "loan_officer" && p.email === "jim@meploans.com") as Profile | undefined;
    const rRow = (data || []).find((p) => p.role === "realtor") as Profile | undefined;
    if (loRow) lo = buildDrafterProfile(loRow);
    if (rRow) realtor = { ...buildDrafterProfile(rRow), brokerage: rRow.brokerage || realtor.brokerage, productsCapabilities: rRow.products_capabilities || realtor.productsCapabilities };
  } catch (e) {
    console.log("  (profiles not loaded from Supabase, using fallbacks)", e instanceof Error ? e.message : e);
  }
  return { lo, realtor };
}

async function main() {
  const args = process.argv.slice(2);
  const runLo = !args.includes("--realtor-only");
  const runRealtor = !args.includes("--lo-only");
  const { lo, realtor } = await loadProfiles();
  const mep = lo.website || "https://mortgageequitypartners.com/james-driscoll/";
  console.log(`\nLO profile: ${lo.firstName} ${lo.lastName}, NMLS ${lo.nmls}, landing ${mep}`);

  const jobs: Array<Promise<void>> = [];

  if (runLo) {
    jobs.push(
      (async () => {
        const name = "Boston Metro Refinance";
        const pkg = await chatgptAdsService.generateCampaignPackage({
          profile: lo,
          name,
          objective: LO_OBJECTIVES.find((o) => o.key === "refinance")!,
          target_market: "Boston metro",
          daily_budget: 50,
          bid_type: "cpc",
          landing_page_url: mep,
          resources: []
        });
        console.log(`\n== 1. ${name} ==`);
        printGroups(pkg.ad_groups);
        console.log("\n  review notes:", pkg.review_notes);
        assertGroups("refi", pkg.ad_groups, mep, name);
        assertLoCompliance("refi", pkg.ad_groups, lo.nmls);
      })()
    );
    jobs.push(
      (async () => {
        const name = "Investor HELOC";
        const pkg = await chatgptAdsService.generateCampaignPackage({
          profile: lo,
          name,
          objective: LO_OBJECTIVES.find((o) => o.key === "heloc")!,
          target_market: "Massachusetts and New Hampshire",
          daily_budget: 40,
          bid_type: "cpc",
          landing_page_url: mep,
          tone_notes: "Aimed at investment property owners.",
          resources: []
        });
        console.log(`\n== 2. ${name} ==`);
        printGroups(pkg.ad_groups);
        assertGroups("heloc", pkg.ad_groups, mep, name);
        assertLoCompliance("heloc", pkg.ad_groups, lo.nmls);
        const all = pkg.ad_groups.map((g) => `${g.name} ${g.audience_theme} ${g.ad_headline} ${g.ad_body} ${g.targeting_instructions}`).join("\n");
        check("heloc: mentions investment/rental property HELOC", /(investment|rental)[- ]propert(y|ies)/i.test(all) && /HELOC|equity line/i.test(all));
        check("heloc: mentions bank statement equity line", /bank statement/i.test(all));
        check("heloc: mentions DSCR", /DSCR/i.test(all));
      })()
    );
  }

  if (runRealtor) {
    jobs.push(
      (async () => {
        const name = "Lynnfield Buyer Leads";
        const site = realtor.website || "https://example-realty.com/";
        const pkg = await chatgptAdsService.generateCampaignPackage({
          profile: realtor,
          name,
          objective: REALTOR_OBJECTIVES.find((o) => o.key === "buyer_leads")!,
          target_market: "Lynnfield and the North Shore, MA",
          daily_budget: 20,
          bid_type: "cpc",
          landing_page_url: site,
          resources: []
        });
        console.log(`\n== 3. ${name} (realtor) ==`);
        printGroups(pkg.ad_groups);
        assertGroups("realtor", pkg.ad_groups, site, name);
        assertRealtorCompliance("realtor", pkg.ad_groups);
      })()
    );
  }

  await Promise.all(jobs);
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
