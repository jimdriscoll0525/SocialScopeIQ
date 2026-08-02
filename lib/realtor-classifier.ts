import Anthropic from "@anthropic-ai/sdk";
import { CLASSIFY_MODEL } from "./config";
import type { IntentTier } from "./types";

// Realtor-lead classification: a broad regex prefilter (free) followed by one
// small AI call (cheap) per surviving candidate. Posts only reach this after
// the hard geo gate in run-scout.ts (detected state must be MA or NH), so
// volume is already low. The regex tier classifier in lib/drafter.ts stays
// untouched — the LO pipeline is unchanged.

export type RealtorCategory =
  | "agent_recommendation"
  | "buying"
  | "selling"
  | "relocating"
  | "new_to_area"
  | "town_comparison"
  | "other";

export interface RealtorClassification {
  relevant: boolean;
  category: RealtorCategory;
  mortgage_specific: boolean;
}

// Broad on purpose: its only job is to skip obvious non-real-estate noise
// (career advice, generic personalfinance chatter) before spending an AI
// call. The AI pass makes the real decision, so err toward matching.
const REALTOR_PREFILTER =
  /\b(house|home|condo|townhou|apartment|property|real estate|realtor|agent|broker|neighborhood|neighbourhood|town|suburb|school district|schools|relocat|moving|move to|new to|buy|bought|sell|sold|listing|open house|offer|closing|commute|rent)/i;

export function passesRealtorPrefilter(text: string): boolean {
  return REALTOR_PREFILTER.test(text);
}

const CLASSIFIER_PROMPT = `
You classify online posts for a real estate AGENT lead feed (Massachusetts and New Hampshire). Decide if the post is a good lead for a realtor.

KEEP (relevant=true) posts about: buying or selling a home, relocating, being new to an area, comparing towns or neighborhoods, or asking for real estate agent recommendations.

EXCLUDE (relevant=false) posts that are purely mortgage-specific: rates, pre-approval, loan programs, refinancing, lender recommendations. Those route to a loan-officer feed instead. A post can be BOTH mortgage-specific AND realtor-relevant (e.g. a first-time buyer asking about both financing and which towns to look in) — in that case set relevant=true and mortgage_specific=true.

Also exclude: landlord/tenant disputes, contractor/repair questions, pure investment strategy talk with no buy/sell intent, and posts where the author is clearly a real estate professional rather than a potential client.

Return ONLY a JSON object (no markdown fences, no commentary):
{
  "relevant": true or false,
  "category": "agent_recommendation" | "buying" | "selling" | "relocating" | "new_to_area" | "town_comparison" | "other",
  "mortgage_specific": true or false
}
`.trim();

// One classification call. Returns null on ANY failure (missing key, API
// error, unparseable output) — the caller treats null as not-relevant, so the
// realtor feed fails closed rather than filling with junk.
export async function classifyRealtorLead(input: {
  title: string;
  body: string;
}): Promise<RealtorClassification | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[realtor-classifier] ANTHROPIC_API_KEY not set — skipping");
    return null;
  }

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: CLASSIFY_MODEL,
      max_tokens: 200,
      system: CLASSIFIER_PROMPT,
      messages: [
        {
          role: "user",
          content: `Title: ${input.title}\n\nBody:\n"""\n${(input.body || "").slice(0, 2000)}\n"""`
        }
      ]
    });

    const text = msg.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("");
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<RealtorClassification>;

    if (typeof parsed.relevant !== "boolean") return null;
    const categories: RealtorCategory[] = [
      "agent_recommendation", "buying", "selling", "relocating",
      "new_to_area", "town_comparison", "other"
    ];
    return {
      relevant: parsed.relevant,
      category: categories.includes(parsed.category as RealtorCategory)
        ? (parsed.category as RealtorCategory)
        : "other",
      mortgage_specific: parsed.mortgage_specific === true
    };
  } catch (err) {
    console.warn("[realtor-classifier] classification failed:", err);
    return null;
  }
}

// Tier mapping for realtor-only leads (the LO regex tiers don't apply):
// direct agent asks are hottest; active buy/sell/relocate intent next;
// exploratory research last.
export function realtorCategoryTier(category: RealtorCategory): IntentTier {
  if (category === "agent_recommendation") return "TIER 1";
  if (category === "buying" || category === "selling" || category === "relocating") return "TIER 2";
  return "TIER 3";
}

export function realtorCategoryLabel(category: RealtorCategory): string {
  const labels: Record<RealtorCategory, string> = {
    agent_recommendation: "Agent recommendation ask",
    buying: "Home buying",
    selling: "Home selling",
    relocating: "Relocating",
    new_to_area: "New to the area",
    town_comparison: "Town comparison",
    other: "Real estate question"
  };
  return labels[category];
}
