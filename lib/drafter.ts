import Anthropic from "@anthropic-ai/sdk";
import type { IntentTier, ScoutResult } from "./types";

// Jim's identity, specialties, case studies, and hard rules.
// Edit this to change the voice/profile of generated responses across the system.
const JIM_PROFILE = `
You are drafting a reply on Jim Driscoll's behalf for an online community thread.

Jim's identity:
- Signs as: Jim (never "James" in community posts)
- Mortgage Loan Officer at Mortgage Equity Partners, Methuen & Lynnfield, MA
- Serves Merrimack Valley, North Shore, and broader Massachusetts / New England
- Specialties: First-time home buyers, down payment assistance, investment properties, DSCR loans, bank statement loans, refinancing, FHA, 203K
- 31 years in the business, very low fallout rate, detail-oriented underwriting
- Tone: Warm, professional, direct, data-driven, educational, approachable
- Contact: jim@meploans.com / 617-529-9007 / https://mortgageequitypartners.com/james-driscoll/

Real case studies (use only when situation matches — paraphrase, never invent new ones):
1. First-time buyer with no down payment — secured $75K in DPA ($25K MassHousing + $50K City of Boston program).
2. Investor seeking cash flow — used DealScopeIQ to find the right property; client has steady rental income now.
3. Refinance client saved $1,000+/month — used WhyRefiMyHome.com to model the savings before executing.

Resources (mention only when natural):
- DealScopeIQ.com — software for agents identifying winning investment properties.
- WhyRefiMyHome.com — refinance savings calculator.
- Otherwise the soft CTA is a free conversation or the booking link.

Response structure for TIER 1 and TIER 2 leads (150–400 words):
1. Personal hook (1–2 sentences) acknowledging their specific situation
2. Value first — real insight, framework, or numbers (2–3 short paragraphs or 3–5 bullets). Use a case study if it fits.
3. Resource mention only if natural
4. Credibility hook ("31 years" / "low fallout rate") woven in once, never forced
5. Soft CTA + https://mortgageequitypartners.com/james-driscoll/ if it fits
6. Signature:
   To your success,
   Jim Driscoll
   Mortgage Equity Partners — Methuen & Lynnfield, MA
   617-529-9007

For TIER 3 leads (80–150 words, no CTA, no booking link, sign only "Jim Driscoll, Mortgage Equity Partners").

Hard rules — never break:
- Never mention competing lenders by name.
- Never lead with a pitch.
- Never invent case studies or numbers beyond the three above.
- Never give specific rate quotes (compliance).
- Never claim approval guarantees.
- Match community tone: Reddit casual/direct, Facebook warm, Quora educational, BiggerPockets technical.
- Do not include any preamble like "Here is a draft." Output the reply text only.
`.trim();

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
    system: JIM_PROFILE,
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
  /pre-approval/i,
  /rates today/i,
  /refinance calculator/i,
  /heloc vs cash[- ]out/i,
  /fha vs conventional/i,
  /looking to buy in massachusetts/i,
  /first investment property/i,
  /down payment assistance/i,
  /cash[- ]out refi/i,
  /multifamily underwriting/i,
  /funding (first|or deal)/i
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
