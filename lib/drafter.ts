import Anthropic from "@anthropic-ai/sdk";
import { HUMANIZER_RULES } from "./humanizer";
import { DRAFT_MODEL } from "./config";
import type { IntentTier, Profile, Role } from "./types";

// ─── Drafter profiles ────────────────────────────────────────────────────────
// The persona used to season every draft. Built from the user's profiles row;
// JIM_FALLBACK_PROFILE reproduces the pre-multi-user hardcoded persona and is
// used by the scout cron when OWNER_USER_ID is unset or unreadable, so the
// daily pipeline can never break on a missing profile.

export interface DrafterProfile {
  role: Role;
  firstName: string;
  lastName: string;
  company: string | null; // loan officer
  brokerage: string | null; // realtor
  nmls: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  statesServed: string[];
  townsServed: string[];
  niche: string | null;
  voiceSample: string | null;
  caseStudies: string | null;
}

export function buildDrafterProfile(row: Profile): DrafterProfile {
  return {
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    company: row.company,
    brokerage: row.brokerage,
    nmls: row.nmls,
    phone: row.phone,
    email: row.email,
    website: row.website,
    statesServed: row.states_served || [],
    townsServed: row.towns_served || [],
    niche: row.niche,
    voiceSample: row.voice_sample,
    caseStudies: row.case_studies
  };
}

export const JIM_FALLBACK_PROFILE: DrafterProfile = {
  role: "loan_officer",
  firstName: "Jim",
  lastName: "Driscoll",
  company: "Mortgage Equity Partners",
  brokerage: null,
  nmls: "21420",
  phone: "617-529-9007",
  email: "jim@meploans.com",
  website: "https://mortgageequitypartners.com/james-driscoll/",
  statesServed: ["MA", "NH", "RI", "NJ", "ME", "CT", "FL"],
  townsServed: [],
  niche:
    "First-time home buyers, down payment assistance, investment properties, DSCR loans, bank statement loans, refinancing, FHA, 203K",
  voiceSample:
    "A mortgage loan officer with 31 years in the mortgage business, very low fallout rate, detail-oriented underwriting. Based in Massachusetts / New England.",
  caseStudies: `1. First-time buyer with no down payment, secured $75K in down payment assistance ($25K MassHousing + $50K City of Boston program).
2. Investor seeking cash flow, carefully analyzed the deal up front; the client now has steady rental income.
3. Refinance client saved $1,000+/month, modeled the savings carefully before executing.`
};

// ─── Base prompts (per role) ─────────────────────────────────────────────────

function fullName(p: DrafterProfile): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

function territory(p: DrafterProfile): string {
  if (p.townsServed.length > 0 && p.statesServed.length > 0) {
    return `${p.townsServed.join(", ")} (${p.statesServed.join(", ")})`;
  }
  if (p.townsServed.length > 0) return p.townsServed.join(", ");
  if (p.statesServed.length > 0) return p.statesServed.join(", ");
  return "their local market";
}

function caseStudiesSection(p: DrafterProfile): string {
  if (!p.caseStudies?.trim()) return "";
  return `

Real case studies (use only when the situation matches, paraphrase, never invent new ones; do NOT name ${p.firstName}'s own company, product, website, or tool in the body):
${p.caseStudies.trim()}`;
}

// Stale-training-data corrections shared by every LOAN OFFICER draft. This is
// domain knowledge, not per-user data — extend the list here when the model
// gets called out for an outdated fact in a posted reply.
export const LO_FACT_CORRECTIONS = `
Fact corrections (your training data is stale on these; the values below are current and override what you remember — loan officers have been called out for getting these wrong in posted replies):
- FHA Limited 203(k): the renovation cost cap is $75,000. HUD raised it from $35,000 effective November 2024. NEVER say the Limited 203(k) caps at $35,000.`.trimEnd();

function buildLoBaseProfile(p: DrafterProfile): string {
  const name = fullName(p);
  return `
You are drafting a reply on ${name}'s behalf for an online community thread.

${name}'s identity:
- Signs as: ${p.firstName} (never a more formal variant in community posts)
- About them, in their own words (match this voice; use only these facts for credibility, never invent more): ${p.voiceSample?.trim() || "An experienced mortgage loan officer."}
- Based in: ${territory(p)} (use only as context when a poster's location is relevant, never as a plug)
- Specialties: ${p.niche?.trim() || "residential mortgage lending"}
- Tone: Warm, professional, direct, data-driven, educational, approachable. Write like a knowledgeable person genuinely helping a stranger, not like a salesperson.${caseStudiesSection(p)}

Response approach (all tiers; ~120-350 words, lighter touch ~80-150 words for TIER 3):
1. Answer the question first. Lead with real, expert value: insight, a framework, specific numbers, programs, or examples where they genuinely help. Use a case study only if it fits.
2. Acknowledge tradeoffs honestly instead of overselling any one option.
3. Weave credibility in once, naturally (drawing on the "About them" line above), never forced, never a pitch.

Hard rules, never break:
- Never lead with a pitch.
- Never mention competing lenders by name.
- Never invent case studies or numbers beyond any listed above.
- Never give specific rate quotes (compliance).
- Never claim approval guarantees.
- Match community tone: Reddit casual/direct, BiggerPockets technical, Stack Exchange precise/educational.
- Do not include any preamble like "Here is a draft." Output the reply text only.

${LO_FACT_CORRECTIONS}
`.trim();
}

function buildRealtorBaseProfile(p: DrafterProfile): string {
  const name = fullName(p);
  return `
You are drafting a reply on ${name}'s behalf for an online community thread.

${name}'s identity:
- Signs as: ${p.firstName}
- A real estate agent${p.brokerage ? ` with ${p.brokerage}` : ""} serving ${territory(p)}
- About them, in their own words (match this voice; use only these facts for credibility, never invent more): ${p.voiceSample?.trim() || "A knowledgeable local real estate agent."}
- Specialties: ${p.niche?.trim() || "residential real estate"}
- Tone: Warm, local, plainspoken, genuinely helpful — a neighbor who knows the market, not a salesperson.${caseStudiesSection(p)}

Response approach (~80-250 words):
1. Answer the actual question first with specific local insight: towns, commutes, process steps, what to expect — real substance, not generalities.
2. Acknowledge tradeoffs honestly (every town and every strategy has them).
3. At most one natural credibility mention, drawn from the "About them" line. Never forced.

Hard rules, never break:
- FAIR HOUSING: never characterize neighborhoods or towns by the demographics of the people who live there (race, ethnicity, religion, national origin, family status, disability), and never steer. Describe property, prices in general terms, process, commute, amenities, and lifestyle facts. For schools, point to objective sources (state report cards, test-score sites) rather than labeling schools or towns "good" or "bad".
- Never invent market statistics, comps, or sale prices.
- Never disparage other agents or brokerages.
- Never lead with a pitch.
- Match the community's tone.
- Do not include any preamble like "Here is a draft." Output the reply text only.
`.trim();
}

// ─── Contact policy (per role + platform) ────────────────────────────────────

type ContactPolicy = "no-contact" | "with-contact" | "name-only" | "soft-close";

// Loan-officer platforms that carry the full signature block. Reddit is
// deliberately absent (contact-free) and BiggerPockets is name-only (strict
// anti-solicitation). Anything unmatched falls through to the safer
// no-contact template with a warning, so a brand-new source can never
// silently start emitting contact info.
const KNOWN_CONTACT_SOURCES = [
  "stackexchange",
  "stack exchange",
  "facebook",
  "nextdoor",
  "quora",
  "linkedin"
];

// Detection is on BOTH fields because the scouts populate them differently:
// Reddit sets community="Reddit" but source=the subreddit (e.g. "r/Mortgages").
function resolveContactPolicy(community: string, source: string, role: Role): ContactPolicy {
  const hay = `${community} ${source}`.toLowerCase();

  if (role === "realtor") {
    if (hay.includes("reddit")) return "no-contact";
    if (hay.includes("biggerpockets") || hay.includes("bigger pockets")) return "name-only";
    // Neighborly platforms get the warm answer + soft "DM me" close; other
    // known platforms get name-only (never a license number or phone).
    if (hay.includes("facebook") || hay.includes("nextdoor")) return "soft-close";
    if (KNOWN_CONTACT_SOURCES.some((s) => hay.includes(s))) return "name-only";
    console.warn(
      `[drafter] Unrecognized realtor lead source (community="${community}", source="${source}"). Defaulting to no-contact.`
    );
    return "no-contact";
  }

  if (hay.includes("reddit")) return "no-contact";
  if (hay.includes("biggerpockets") || hay.includes("bigger pockets")) return "name-only";
  if (KNOWN_CONTACT_SOURCES.some((s) => hay.includes(s))) return "with-contact";
  console.warn(
    `[drafter] Unrecognized lead source (community="${community}", source="${source}"). ` +
      "Defaulting to the safer no-contact template. Add it to KNOWN_CONTACT_SOURCES " +
      "in lib/drafter.ts if this platform should include the signature."
  );
  return "no-contact";
}

// The signature block for with-contact drafts, built from the profile. For
// Jim's seeded profile this reproduces the previously hardcoded block exactly.
function signatureBlock(p: DrafterProfile): string {
  const lines: string[] = [fullName(p)];
  if (p.company) lines.push(p.company);
  const contact = [p.phone, p.email].filter(Boolean).join(" | ");
  if (contact) lines.push(contact);
  if (p.website) lines.push(p.website);
  if (p.nmls) lines.push(`NMLS #${p.nmls}`);
  return lines.join("\n");
}

function contactSection(policy: ContactPolicy, platformLabel: string, p: DrafterProfile): string {
  const name = fullName(p);
  const orgName = p.company || p.brokerage;
  const orgExample = orgName ? ` (e.g. "${orgName}")` : "";

  if (policy === "name-only") {
    return `
You are drafting a response to a ${platformLabel} post. This platform strictly enforces anti-solicitation rules, so the response must NOT include contact information of any kind: no phone number, no email, no website or URL, no company name${orgExample}, no NMLS or license number, no product or tool name, and no invitation to DM or reach out. People who want to reach ${p.firstName} will look them up.

End the response with ${p.firstName}'s full name alone on its own line, exactly:

${name}

Nothing before it on that line and nothing after it. No divider, no title, no company, no "Best," or other valediction. Just the helpful answer, then a blank line, then "${name}".`.trim();
  }

  if (policy === "with-contact") {
    return `
You are drafting a response to a ${platformLabel} post. After your helpful answer, end with this exact signature block. Separate it from the body with a blank line and a "---" divider line on its own, then the signature exactly as written:

---
${signatureBlock(p)}

Signature rules:
- Reproduce the block exactly: same lines, same order, same details. Do not paraphrase or reformat it.
- The signature is the ONLY place contact details appear. Keep the body a clean expert answer with no phone, email, URL, or company name scattered in it.
- Place the signature only at the very end, as a clear sign-off. Do not add anything after it.`.trim();
  }

  if (policy === "soft-close") {
    return `
You are drafting a response to a ${platformLabel} post, typically inside a local community group. Voice: a warm, helpful neighbor who happens to be a local real estate expert — never a salesperson.

- Genuinely answer the question first with specific, useful, local detail.
- NO signature block, NO license number, NO brokerage or company name, NO phone, email, or URL.
- End with exactly one soft, low-pressure close along the lines of "Happy to chat if you want, feel free to DM me." — one short sentence, vary the wording naturally so it doesn't read as a template.`.trim();
  }

  return `
You are drafting a response to a ${platformLabel} post. The response must NOT include any contact information, signatures, phone numbers, email addresses, websites, company names, or invitations to DM. Just answer the question helpfully and end the response naturally, the way a knowledgeable peer would end it, not like a sales pitch.

Specifically:
- No phone number, no email, no website or URL, no company name${orgExample}, no product or tool name.
- No "feel free to reach out" or "happy to help" tied to any contact mechanism, and no DM invitation of any kind.
- No signature block. Do not even sign off with "${p.firstName}". End on the substance of the answer.`.trim();
}

// Build the system prompt: role-specific base profile + the platform contact
// rules + the humanizer style rules (every platform, single pass).
function buildSystemPrompt(policy: ContactPolicy, platformLabel: string, p: DrafterProfile): string {
  const base = p.role === "realtor" ? buildRealtorBaseProfile(p) : buildLoBaseProfile(p);
  return `${base}\n\n${contactSection(policy, platformLabel, p)}\n\n${HUMANIZER_RULES}`;
}

// ─── Drafting ────────────────────────────────────────────────────────────────

export interface DraftRequest {
  community: string;
  source: string;
  post_title: string;
  author: string;
  body: string;
  intent_tier: IntentTier;
}

export interface DraftResult {
  drafted_response: string;
  primary_intent: string;
  key_question: string;
  reason_selected: string;
}

export async function draftResponse(
  req: DraftRequest,
  profile: DrafterProfile
): Promise<DraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  const policy = resolveContactPolicy(req.community, req.source, profile.role);
  const platformLabel = req.community || req.source || "community";
  const system = buildSystemPrompt(policy, platformLabel, profile);

  const userPrompt = `
Community: ${req.community}
Source/Forum: ${req.source}
Tier: ${req.intent_tier}
Post title: ${req.post_title}
Author: ${req.author}

Post body:
"""
${req.body}
"""

Return a JSON object with these exact keys (no markdown fences, no commentary):
{
  "primary_intent": "<2-5 word label, e.g. 'DSCR lender referral' or 'First-time buyer prep'>",
  "key_question": "<short quote or paraphrase of what they're actually asking>",
  "reason_selected": "<one sentence on why this lead is worth ${profile.firstName}'s time>",
  "drafted_response": "<the full reply ${profile.firstName} would post, following the structure rules>"
}
`.trim();

  const msg = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: userPrompt }]
  });

  const text = msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Strip optional markdown fences if the model adds any.
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();

  try {
    return JSON.parse(cleaned) as DraftResult;
  } catch {
    // Fallback: stuff the whole text into drafted_response if JSON parsing fails.
    return {
      primary_intent: req.intent_tier,
      key_question: req.post_title,
      reason_selected: "Auto-captured by scout.",
      drafted_response: cleaned
    };
  }
}

// ─── LO tier classifier (regex) ──────────────────────────────────────────────
// Quick rule-based tier classifier used by the scouts to assign tier before drafting.
// Strict matching keeps API costs down — only Tier 1/2 get auto-drafted.
const TIER1_PATTERNS = [
  /looking for (a )?(mortgage )?(broker|lender|loan officer)/i,
  /need(s)? (a )?mortgage (broker|lender)/i,
  /recommend(ations)? for (a )?(loan officer|mortgage|lender)/i,
  /dscr (loan|lender|refi)/i,
  /bank statement loan/i,
  /203k/i,
  /first time home ?buyer .{0,80}(massachusetts|boston|north shore|merrimack)/i,
  /down payment assistance .{0,40}(ma|massachusetts)/i,
  /masshousing/i,
  /investment property (financing|heloc|loan)/i,
  /fix(\s|-)and(\s|-)flip lender/i,
  /refinance my home/i,
  /best mortgage company in .{0,40}(ma|massachusetts|boston)/i
];

const TIER2_PATTERNS = [
  /pre[- ]?approv/i, // pre-approval, preapproval, preapproved
  /rates today/i,
  /refinance calculator/i,
  /\bheloc\b/i,
  /home equity (loan|line)/i,
  /fha vs conventional/i,
  /looking to buy in massachusetts/i,
  /first investment property/i,
  /down payment/i,
  /cash[- ]out refi/i,
  /multifamily underwriting/i,
  /funding (first|or deal)/i,
  /first[- ]?time (home ?buyer|buyer)/i,
  /\bhome loan\b/i,
  /fixer[- ]?upper/i,
  /renovation (loan|mortgage)/i,
  /homestyle/i,
  /closing costs/i,
  /\bpmi\b/i,
  /how much (house|home|mortgage) can (i|we) afford/i
];

const TIER3_PATTERNS = [
  /how does dscr work/i,
  /what is a 203k/i,
  /first[- ]time home ?buyer guide/i,
  /how did you learn/i,
  /when to .{0,30}build .{0,20}team/i
];

export function classifyTier(text: string): IntentTier | null {
  if (TIER1_PATTERNS.some((p) => p.test(text))) return "TIER 1";
  if (TIER2_PATTERNS.some((p) => p.test(text))) return "TIER 2";
  if (TIER3_PATTERNS.some((p) => p.test(text))) return "TIER 3";
  return null;
}
