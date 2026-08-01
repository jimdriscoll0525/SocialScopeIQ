import Anthropic from "@anthropic-ai/sdk";
import { HUMANIZER_RULES } from "./humanizer";
import type { IntentTier, ScoutResult } from "./types";

// Jim's identity, specialties, case studies, and the voice/structure rules
// shared by EVERY draft regardless of platform. Edit this to change Jim's
// voice across the whole system. Platform-specific contact rules (whether to
// include a signature block) are NOT here — see the contact-policy section
// below and buildSystemPrompt().
const JIM_BASE_PROFILE = `
You are drafting a reply on Jim Driscoll's behalf for an online community thread.

Jim's identity:
- Signs as: Jim (never "James" in community posts)
- A mortgage loan officer with 31 years in the mortgage business, very low fallout rate, detail-oriented underwriting
- Based in Massachusetts / New England (use only as context when a poster's location is relevant, never as a plug)
- Specialties: First-time home buyers, down payment assistance, investment properties, DSCR loans, bank statement loans, refinancing, FHA, 203K
- Tone: Warm, professional, direct, data-driven, educational, approachable. Write like a knowledgeable person genuinely helping a stranger, not like a salesperson.

Real case studies (use only when the situation matches, paraphrase, never invent new ones; do NOT name Jim's own company, product, website, or tool in the body):
1. First-time buyer with no down payment, secured $75K in down payment assistance ($25K MassHousing + $50K City of Boston program).
2. Investor seeking cash flow, carefully analyzed the deal up front; the client now has steady rental income.
3. Refinance client saved $1,000+/month, modeled the savings carefully before executing.

Response approach (all tiers; ~120-350 words, lighter touch ~80-150 words for TIER 3):
1. Answer the question first. Lead with real, expert value: insight, a framework, specific numbers, programs, or examples where they genuinely help. Use a case study only if it fits.
2. Acknowledge tradeoffs honestly instead of overselling any one option.
3. Weave credibility in once, naturally ("31 years in the mortgage business"), never forced, never a pitch.

Hard rules, never break:
- Never lead with a pitch.
- Never mention competing lenders by name.
- Never invent case studies or numbers beyond the three above.
- Never give specific rate quotes (compliance).
- Never claim approval guarantees.
- Match community tone: Reddit casual/direct, BiggerPockets technical, Stack Exchange precise/educational.
- Do not include any preamble like "Here is a draft." Output the reply text only.

Fact corrections (your training data is stale on these; the values below are current and override what you remember — Jim has been called out for getting these wrong in posted replies):
- FHA Limited 203(k): the renovation cost cap is $75,000. HUD raised it from $35,000 effective November 2024. NEVER say the Limited 203(k) caps at $35,000.
`.trim();

// The exact signature block appended to non-Reddit drafts. Single source of
// truth so the body text and any tests stay in sync.
const SIGNATURE_BLOCK = `Jim Driscoll
Mortgage Equity Partners
617-529-9007 | jim@meploans.com
https://mortgageequitypartners.com/james-driscoll/
NMLS #21420`;

type ContactPolicy = "no-contact" | "with-contact" | "name-only";

// Platforms we EXPLICITLY know how to handle and that should carry Jim's full
// signature block. Reddit is deliberately absent (it gets the contact-free
// template), and BiggerPockets is handled separately (name-only signature —
// its anti-solicitation enforcement is strict, so drafts end with just
// "Jim Driscoll" and zero contact info). Anything not matched here AND not
// Reddit/BiggerPockets falls through to the safer no-contact template and
// logs a warning, so a brand-new source can never silently start emitting
// Jim's phone/email/NMLS until we add a rule.
const KNOWN_CONTACT_SOURCES = [
  "stackexchange",
  "stack exchange",
  "facebook",
  "nextdoor",
  "quora",
  "linkedin"
];

// Decide the contact policy from the lead's community/source fields.
// Detection is on BOTH fields because the scouts populate them differently:
// Reddit sets community="Reddit" but source=the subreddit (e.g. "r/Mortgages"),
// so matching source alone would miss every Reddit lead.
function resolveContactPolicy(community: string, source: string): ContactPolicy {
  const hay = `${community} ${source}`.toLowerCase();
  if (hay.includes("reddit")) return "no-contact";
  if (hay.includes("biggerpockets") || hay.includes("bigger pockets")) return "name-only";
  if (KNOWN_CONTACT_SOURCES.some((s) => hay.includes(s))) return "with-contact";
  console.warn(
    `[drafter] Unrecognized lead source (community="${community}", source="${source}"). ` +
      "Defaulting to the safer no-contact template. Add it to KNOWN_CONTACT_SOURCES " +
      "in lib/drafter.ts if this platform should include Jim's signature."
  );
  return "no-contact";
}

// FUTURE ENHANCEMENT (not built): a more conservative non-Reddit policy would
// include the full signature ONLY when the post explicitly asks for a
// recommendation / referral / lender contact ("anyone know a good lender?"),
// and otherwise sign with a one-liner like "- Jim, mortgage LO". Safer for
// BiggerPockets' anti-solicitation enforcement, but adds intent-detection
// complexity. For now we send the full signature on all non-Reddit sources.

// Build the system prompt: shared base profile + the platform-specific
// contact rules + the humanizer style rules (every platform, single pass).
function buildSystemPrompt(policy: ContactPolicy, platformLabel: string): string {
  const contactSection =
    policy === "name-only"
      ? `
You are drafting a response to a ${platformLabel} post. This platform strictly enforces anti-solicitation rules, so the response must NOT include contact information of any kind: no phone number, no email, no website or URL, no company name (e.g. "Mortgage Equity Partners"), no NMLS number, no product or tool name, and no invitation to DM or reach out. People who want to reach Jim will look him up.

End the response with Jim's full name alone on its own line, exactly:

Jim Driscoll

Nothing before it on that line and nothing after it. No divider, no title, no company, no "Best," or other valediction. Just the helpful answer, then a blank line, then "Jim Driscoll".`.trim()
      : policy === "with-contact"
      ? `
You are drafting a response to a ${platformLabel} post. After your helpful answer, end with this exact signature block. Separate it from the body with a blank line and a "---" divider line on its own, then the signature exactly as written:

---
${SIGNATURE_BLOCK}

Signature rules:
- Reproduce the block exactly: same lines, same order, same phone, email, URL, company name, and NMLS number. Do not paraphrase or reformat it.
- The signature is the ONLY place contact details appear. Keep the body a clean expert answer with no phone, email, URL, or company name scattered in it.
- Place the signature only at the very end, as a clear sign-off. Do not add anything after it.`.trim()
      : `
You are drafting a response to a ${platformLabel} post. The response must NOT include any contact information, signatures, phone numbers, email addresses, websites, company names, or invitations to DM. Just answer the question helpfully and end the response naturally, the way a knowledgeable peer would end it, not like a sales pitch.

Specifically:
- No phone number, no email, no website or URL, no company name (e.g. "Mortgage Equity Partners"), no product or tool name.
- No "feel free to reach out" or "happy to help" tied to any contact mechanism, and no DM invitation of any kind.
- No signature block. Do not even sign off with "Jim". End on the substance of the answer.`.trim();

  return `${JIM_BASE_PROFILE}\n\n${contactSection}\n\n${HUMANIZER_RULES}`;
}

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

export async function draftResponse(req: DraftRequest): Promise<DraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  // Platform-aware contact policy: Reddit (and any unrecognized source) gets a
  // contact-free reply; known non-Reddit sources get Jim's full signature.
  const policy = resolveContactPolicy(req.community, req.source);
  const platformLabel = req.community || req.source || "community";
  const system = buildSystemPrompt(policy, platformLabel);

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
  "reason_selected": "<one sentence on why this lead is worth Jim's time>",
  "drafted_response": "<the full reply Jim would post, following the structure rules>"
}
`.trim();

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
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
