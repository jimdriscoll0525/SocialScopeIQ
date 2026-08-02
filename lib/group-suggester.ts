import Anthropic from "@anthropic-ai/sdk";
import { DRAFT_MODEL } from "./config";
import type { DrafterProfile } from "./drafter";

// AI candidate list for the Group Map: likely Facebook group names for the
// user's territory and niche. The model can't verify a group exists — each
// suggestion is a search target, and the UI links to Facebook group search.

export interface GroupSuggestion {
  name: string;
  why: string;
}

export async function suggestGroups(
  profile: DrafterProfile,
  existingNames: string[]
): Promise<GroupSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });

  const isRealtor = profile.role === "realtor";
  const towns = profile.townsServed.join(", ") || "(no towns listed)";
  const states = profile.statesServed.join(", ") || "(no states listed)";

  const system = `
You suggest Facebook groups a local ${isRealtor ? "real estate agent" : "mortgage loan officer"} should join to be genuinely helpful where home buyers and owners already gather. Suggest the KINDS of groups that really exist on Facebook, named the way locals actually name them:
- Town community groups ("<Town> MA Community", "<Town> Residents", "What's Happening in <Town>")
- Town buy/sell/trade groups (buyers browsing these are often moving in or fixing up)
- Regional home buyer / homeowner / real estate groups for the area
- Niche groups matching their specialties (first-time buyers, investors, house hacking) scoped to the region when possible

Rules:
- 10 to 14 suggestions, each a plausible real-world group NAME, not a description.
- Cover the specific towns first, then the wider region.
- Skip anything in the "already tracked" list, including close variants.
- "why" is one short sentence: who's in the group and why it fits this person.
- Return ONLY a JSON array, no fences, no commentary: [{"name": "...", "why": "..."}]
`.trim();

  const user = `
Territory towns: ${towns}
States: ${states}
Specialties: ${profile.niche || "general residential"}

Already tracked (skip these and near-duplicates):
${existingNames.length > 0 ? existingNames.map((n) => `- ${n}`).join("\n") : "(none)"}
`.trim();

  const msg = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: user }]
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
    throw new Error("Suggestion output was not valid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("Suggestion output was not an array");

  const seen = new Set(existingNames.map((n) => n.toLowerCase()));
  const out: GroupSuggestion[] = [];
  for (const item of parsed) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const why = typeof item?.why === "string" ? item.why.trim() : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name: name.slice(0, 200), why: why.slice(0, 300) });
  }
  return out;
}

// Facebook group-search deep link for a suggested name.
export function fbGroupSearchUrl(name: string): string {
  return `https://www.facebook.com/search/groups/?q=${encodeURIComponent(name)}`;
}
