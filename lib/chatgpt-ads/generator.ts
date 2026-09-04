import Anthropic from "@anthropic-ai/sdk";
import { DRAFT_MODEL } from "@/lib/config";
import type { DrafterProfile } from "@/lib/drafter";
import type { AdBidType } from "@/lib/types";
import type { AdObjective } from "./objectives";
import { withUtm } from "./utm";

// AI campaign package generation for ChatGPT Ads. Same provider/pattern as
// the response drafter (Anthropic SDK, DRAFT_MODEL, JSON-only output).
// Internal to the service layer — callers go through chatgptAdsService.

export interface GenerateCampaignInput {
  profile: DrafterProfile;
  name: string;
  objective: AdObjective;
  target_market: string;
  daily_budget: number;
  bid_type: AdBidType;
  landing_page_url: string;
  tone_notes?: string | null;
  resources: Array<{ title: string; content: string }>;
}

export interface GeneratedAdGroup {
  name: string;
  audience_theme: string;
  targeting_instructions: string;
  ad_headline: string;
  ad_body: string;
  ad_image_prompt: string;
  landing_page_url: string; // final URL with UTM params
}

export interface CampaignPackage {
  ad_groups: GeneratedAdGroup[];
  // Things the model flags for the human to double-check before submitting
  // (e.g. "confirm the HELOC page mentions investment properties").
  review_notes: string[];
}

const MAX_RESOURCE_CHARS = 8000;
const MAX_TOTAL_RESOURCE_CHARS = 24000;

function loCompliance(p: DrafterProfile): string {
  const nmls = p.nmls ? `NMLS #${p.nmls}` : "NMLS #<number>";
  const company = p.company || "the lender";
  return `
COMPLIANCE — MORTGAGE / FINANCIAL SERVICES (hard rules, every ad):
- Financial services ads face strict approval on ChatGPT Ads. Copy must be conservative, factual, and disclosure-friendly. When in doubt, say less.
- NEVER state or imply a guaranteed rate, payment, savings amount, approval, or outcome. Banned words/phrases: "guaranteed", "pre-approved", "pre-qualified", "you're approved", "lowest rate", "best rate", "no closing costs", "free", "act now", "limited time", "instant approval".
- NEVER quote a specific interest rate, APR, or monthly payment (that triggers Truth in Lending disclosure requirements the ad format can't satisfy).
- NEVER promise cash or describe equity as "free money". Say "may", "could", "options", "explore", "see if".
- No fear or urgency tactics, no comparisons that disparage banks or other lenders.
- Every ad_body must END with this disclosure tail exactly: "${nmls}. Equal Housing Lender." (the platform allows it in body copy; the user will trim if their Ads Manager field limit requires it).
- Identify the advertiser honestly: ${p.firstName} ${p.lastName}${p.company ? `, ${company}` : ""}.
- Only promote products that appear in the WHAT THEY OFFER list below. Never invent a product, program, or eligibility rule.
- Targeting must never reference protected characteristics (race, color, religion, national origin, sex, familial status, disability, age) — target the question being asked, never who is asking.`.trim();
}

function realtorCompliance(p: DrafterProfile): string {
  return `
COMPLIANCE — REAL ESTATE / FAIR HOUSING (hard rules, every ad):
- FAIR HOUSING: never characterize a neighborhood, town, or property by the demographics of the people who live there, and never steer. No "family-friendly", "safe neighborhood", "great schools" style labels — describe property, price range in general terms, commute, amenities, and process instead.
- Targeting must never reference protected characteristics (race, color, religion, national origin, sex, familial status, disability, age) — target the question being asked, never who is asking.
- Never invent market statistics, comps, days-on-market, or sale prices. No "guaranteed sale", "guaranteed price", or "sell in X days" claims.
- No urgency or fear tactics, no disparaging other agents or brokerages.
- Identify the advertiser honestly: ${p.firstName} ${p.lastName}${p.brokerage ? `, ${p.brokerage}` : ""}. Include the brokerage name in ad_body when one is provided.
- This is NOT a mortgage ad: do not mention NMLS numbers, interest rates, APRs, loan approval, or "Equal Housing Lender". End each ad_body with "Equal Housing Opportunity."
- Only promote services that appear in the WHAT THEY OFFER list below (when provided). Never invent a service.`.trim();
}

function capabilitiesSection(p: DrafterProfile): string {
  const text = p.productsCapabilities?.trim();
  if (!text) return `WHAT ${p.firstName.toUpperCase()} OFFERS: (not provided — keep product claims generic and conservative)`;
  return `WHAT ${p.firstName.toUpperCase()} OFFERS (their real product/service list — the ONLY things the ads may promote; when a segment maps to a listed item, name that item in the copy the way the list names it):
${text}`;
}

function resourcesSection(resources: GenerateCampaignInput["resources"]): string {
  if (resources.length === 0) return "";
  let budget = MAX_TOTAL_RESOURCE_CHARS;
  const blocks: string[] = [];
  for (const r of resources) {
    if (budget <= 0) break;
    const content = r.content.trim().slice(0, Math.min(MAX_RESOURCE_CHARS, budget));
    budget -= content.length;
    blocks.push(`--- ${r.title.trim()} ---\n${content}`);
  }
  return `

REFERENCE MATERIAL (supplied by the advertiser; mine it for angles, customer needs, and language — quote facts from it only, never invent beyond it):
${blocks.join("\n\n")}`;
}

function buildSystemPrompt(input: GenerateCampaignInput): string {
  const p = input.profile;
  const isRealtor = p.role === "realtor";
  const who = isRealtor
    ? `a real estate agent${p.brokerage ? ` with ${p.brokerage}` : ""}`
    : `a mortgage loan officer${p.company ? ` with ${p.company}` : ""}`;
  const territory = [p.townsServed.join(", "), p.statesServed.join(", ")].filter(Boolean).join(" — ");

  return `
You are a senior paid-media strategist building a ChatGPT Ads campaign for ${p.firstName} ${p.lastName}, ${who}, serving ${territory || "their local market"}.

HOW CHATGPT ADS WORK (this shapes everything you write):
- Ads appear inside ChatGPT conversations, matched to what the person is asking about RIGHT NOW. Targeting is intent- and topic-based, not demographic. There are no age/income/interest audiences to pick.
- So "targeting_instructions" is a written brief for the ad platform describing the conversations this ad belongs in: the user intents, the questions and prompt topics, example prompt phrasings a person might type, adjacent topics to include, and topics to exclude. Write it as instructions ("Show this ad when the user is asking about…"), 80-160 words, then REQUIRED: a final line that begins exactly with "Example prompts:" followed by 5-8 concrete prompts a person might type, each in double quotes and separated by " | ". Then one line "Exclude:" listing topics that should not match. Mention the target market by name where a local angle helps ("…in the ${input.target_market} area").
- The ad unit is small: a short headline and a brief body. Headline: under 50 characters, specific to the segment, no ALL CAPS, no exclamation marks. Body: 1-2 plain sentences (under 160 characters BEFORE the required disclosure tail), conversational, matching the tone of someone asking ChatGPT a question — helpful, not hype.

CAMPAIGN STRUCTURE:
- Produce 4 to 6 ad groups. Each targets a DISTINCT customer need within the objective — different reasons a person would be asking, not rewordings of one reason. Use the segment list below as the starting point; drop or merge segments that don't fit what ${p.firstName} actually offers, and add one if the reference material reveals a clearly better need.
- Each ad group gets: a short name (2-5 words), an audience_theme (one line), targeting_instructions, ad_headline, ad_body, and ad_image_prompt.
- ad_image_prompt: a one-paragraph prompt for an image generator — photographic, warm, specific to the segment and to the ${input.target_market} area (housing style, season, landscape), NO text or logos in the image, no people depicted in a way that implies targeting a protected class.

${isRealtor ? realtorCompliance(p) : loCompliance(p)}

VOICE: ${p.voiceSample?.trim() ? `Match this voice: ${p.voiceSample.trim()}` : "Plainspoken, experienced, local, helpful."} ${input.tone_notes?.trim() ? `Tone/style notes from the advertiser (follow these): ${input.tone_notes.trim()}` : ""}

${capabilitiesSection(p)}${resourcesSection(input.resources)}

OUTPUT: Return ONLY a JSON object, no markdown fences, no commentary:
{
  "ad_groups": [
    {
      "name": "...",
      "audience_theme": "...",
      "targeting_instructions": "...",
      "ad_headline": "...",
      "ad_body": "...",
      "ad_image_prompt": "..."
    }
  ],
  "review_notes": ["short things the advertiser should double-check before submitting, e.g. that the landing page covers what an ad promises", "..."]
}
`.trim();
}

function buildUserPrompt(input: GenerateCampaignInput): string {
  return `
Campaign name: ${input.name}
Objective: ${input.objective.label}
Target market: ${input.target_market}
Daily budget: $${input.daily_budget} (${input.bid_type.toUpperCase()} bidding)
Landing page: ${input.landing_page_url}

Candidate segments for this objective (starting point — choose 4-6 distinct ones that fit):
${input.objective.segments.map((s) => `- ${s}`).join("\n")}

Build the campaign package now.
`.trim();
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function generateCampaignPackage(input: GenerateCampaignInput): Promise<CampaignPackage> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });

  const msg = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 6000,
    system: buildSystemPrompt(input),
    messages: [{ role: "user", content: buildUserPrompt(input) }]
  });

  const text = msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("")
    .replace(/^```(?:json)?\s*|\s*```$/g, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Campaign generation did not return valid JSON. Try again.");
  }
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const rawGroups = Array.isArray(obj.ad_groups) ? obj.ad_groups : [];

  const ad_groups: GeneratedAdGroup[] = [];
  const seen = new Set<string>();
  for (const raw of rawGroups) {
    const g = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const name = str(g.name, 80);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    ad_groups.push({
      name,
      audience_theme: str(g.audience_theme, 200),
      targeting_instructions: str(g.targeting_instructions, 3000),
      ad_headline: str(g.ad_headline, 120),
      ad_body: str(g.ad_body, 600),
      ad_image_prompt: str(g.ad_image_prompt, 1500),
      landing_page_url: withUtm(input.landing_page_url, input.name, name)
    });
    if (ad_groups.length >= 6) break;
  }
  if (ad_groups.length === 0) throw new Error("Campaign generation returned no ad groups. Try again.");

  const review_notes = Array.isArray(obj.review_notes)
    ? obj.review_notes.map((n) => str(n, 300)).filter(Boolean).slice(0, 8)
    : [];

  return { ad_groups, review_notes };
}
