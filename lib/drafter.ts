import Anthropic from "@anthropic-ai/sdk";
import { HUMANIZER_RULES } from "./humanizer";
import { DRAFT_MODEL } from "./config";
import { isBlockedSubreddit, leadRedditPolicy, type SubredditPolicy } from "./compliance";
import { sanitizeDraft } from "./sanitizer";
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
  productsCapabilities: string | null;
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
    caseStudies: row.case_studies,
    productsCapabilities: row.products_capabilities ?? null
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
3. Refinance client saved $1,000+/month, modeled the savings carefully before executing.`,
  productsCapabilities: null
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

// Optional per-user product/service list. Changes what the reply may talk
// about, never the contact/signature rules. Omitted entirely when the user
// hasn't filled it in, so drafting is unchanged for everyone else.
function capabilitiesSection(p: DrafterProfile): string {
  if (!p.productsCapabilities?.trim()) return "";
  return `

WHAT ${p.firstName.toUpperCase()} OFFERS (their real product/service list):
${p.productsCapabilities.trim()}

If the post is asking about, or would clearly be served by, something on this list, work the SINGLE most relevant item into the reply naturally: mention it is something ${p.firstName} does and briefly how it works, one or two sentences at most, placed after the person's actual question has been answered. Mention one item only, even when several could fit. If nothing on the list is relevant to the post, do not mention any of it. Never make it sound like an ad, and never claim a product or service that is not on the list.`;
}

// Stale-training-data corrections shared by every LOAN OFFICER draft. This is
// domain knowledge, not per-user data — extend the list here when the model
// gets called out for an outdated fact in a posted reply.
export const LO_FACT_CORRECTIONS = `
Fact corrections (your training data is stale on these; the values below are current and override what you remember — loan officers have been called out for getting these wrong in posted replies):
- FHA Limited 203(k): the renovation cost cap is $75,000. HUD raised it from $35,000 effective November 2024. NEVER say the Limited 203(k) caps at $35,000.`.trimEnd();

// Legacy (non-discussion) platforms keep the original comprehensive-answer
// approach. Reddit/BiggerPockets replace it with the one-point discussion
// style (discussionStyleSection below), so those drafts must NOT also carry
// the case studies / capabilities sections or the 120-350 word target.
const LEGACY_LO_APPROACH = `

Response approach (all tiers; ~120-350 words, lighter touch ~80-150 words for TIER 3):
1. Answer the question first. Lead with real, expert value: insight, a framework, specific numbers, programs, or examples where they genuinely help. Use a case study only if it fits.
2. Acknowledge tradeoffs honestly instead of overselling any one option.
3. Weave credibility in once, naturally (drawing on the "About them" line above), never forced, never a pitch.`;

function buildLoBaseProfile(p: DrafterProfile, discussion: boolean): string {
  const name = fullName(p);
  const extras = discussion ? "" : `${caseStudiesSection(p)}${capabilitiesSection(p)}`;
  const approach = discussion ? "" : LEGACY_LO_APPROACH;
  return `
You are drafting a reply on ${name}'s behalf for an online community thread.

${name}'s identity:
- Signs as: ${p.firstName} (never a more formal variant in community posts)
- About them, in their own words (match this voice; use only these facts for credibility, never invent more): ${p.voiceSample?.trim() || "An experienced mortgage loan officer."}
- Based in: ${territory(p)} (use only as context when a poster's location is relevant, never as a plug)
- Specialties: ${p.niche?.trim() || "residential mortgage lending"}
- Tone: Warm, professional, direct, data-driven, educational, approachable. Write like a knowledgeable person genuinely helping a stranger, not like a salesperson.${extras}${approach}

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

const LEGACY_REALTOR_APPROACH = `

Response approach (~80-250 words):
1. Answer the actual question first with specific local insight: towns, commutes, process steps, what to expect — real substance, not generalities.
2. Acknowledge tradeoffs honestly (every town and every strategy has them).
3. At most one natural credibility mention, drawn from the "About them" line. Never forced.`;

function buildRealtorBaseProfile(p: DrafterProfile, discussion: boolean): string {
  const name = fullName(p);
  const extras = discussion ? "" : `${caseStudiesSection(p)}${capabilitiesSection(p)}`;
  const approach = discussion ? "" : LEGACY_REALTOR_APPROACH;
  return `
You are drafting a reply on ${name}'s behalf for an online community thread.

${name}'s identity:
- Signs as: ${p.firstName}
- A real estate agent${p.brokerage ? ` with ${p.brokerage}` : ""} serving ${territory(p)}
- About them, in their own words (match this voice; use only these facts for credibility, never invent more): ${p.voiceSample?.trim() || "A knowledgeable local real estate agent."}
- Specialties: ${p.niche?.trim() || "residential real estate"}
- Tone: Warm, local, plainspoken, genuinely helpful — a neighbor who knows the market, not a salesperson.${extras}${approach}

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

Additionally: no offers of service and no contact invitations of any kind — nothing like "happy to run numbers", "I can help", "reach out", or "DM me". Answer, then stop.

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
You are drafting a response to a ${platformLabel} post. Write it as a knowledgeable individual sharing general information with a stranger — NEVER as a professional soliciting business. Communities like this one permanently ban accounts for self-promotion, and a single slip is unrecoverable.

Hard rules:
- No contact information of any kind: no phone number, no email, no website or URL, no company name${orgExample}, no product or tool name.
- No credentials: no job title, no license or NMLS number, no "licensed in..." lists.
- No offers of service: no "I can help", no "happy to run numbers", no "feel free to reach out", and no DM/message invitation of any kind.
- No signature block. Do not even sign off with "${p.firstName}". End the reply on the substance of the answer, never on a call to action.
- Never point the reader at a professional or service as the takeaway: no "talk to a loan officer", "consult a lender", "worth running by an attorney", or any mention of loan officers, lenders, brokers, or financing services as a suggestion. End on the substance of the answer and never imply the reader could or should work with the author of the reply.`.trim();
}

// Extra rules for STRICT_NO_PROMO subreddits (and any unknown subreddit —
// unknown defaults to strict in lib/compliance.ts). Overrides the base
// profile's credibility-weaving instruction entirely.
function strictNoPromoSection(p: DrafterProfile): string {
  return `
STRICT NO-PROMOTION COMMUNITY — these rules override everything above about credibility:
- Do not mention ${p.firstName}'s job, title, credentials, licenses, years of experience, or that they work in the mortgage or real estate industry in ANY capacity. Not even softened forms like "in my experience working with buyers" or "my clients".
- No first-person professional anecdotes. General knowledge only, stated plainly.
- The reply must read like it was written by a well-informed private individual with no business interest in the topic.`.trim();
}

// ─── Discussion style (Reddit + BiggerPockets) ───────────────────────────────
// These two platforms get the one-point, react-to-the-thread drafting style
// instead of the legacy comprehensive answer. Detection matches the
// sanitizer's platform detection exactly (community OR source, since the
// scouts populate them differently).

export type DiscussionPlatform = "reddit" | "biggerpockets";

export function detectDiscussionPlatform(
  community: string,
  source: string
): DiscussionPlatform | null {
  const hay = `${community} ${source}`.toLowerCase();
  if (/reddit|(^|\s)\/?r\//.test(hay)) return "reddit";
  if (/biggerpockets|bigger pockets/.test(hay)) return "biggerpockets";
  return null;
}

// Randomized length target, injected into the prompt as a hard cap so drafts
// don't all come out the same size (uniform length is itself an AI tell).
export interface LengthTier {
  label: "1-2 sentences" | "3-5 sentences" | "6-8 sentence paragraph";
  rule: string;
}

const TIER_MICRO: LengthTier = {
  label: "1-2 sentences",
  rule: "LENGTH — HARD CAP: 1 to 2 sentences total. Not 3. If the point doesn't fit in 2 sentences, cut it down until it does."
};
const TIER_SHORT: LengthTier = {
  label: "3-5 sentences",
  rule: "LENGTH — HARD CAP: 3 to 5 sentences total, as one short block of prose."
};
const TIER_PARAGRAPH: LengthTier = {
  label: "6-8 sentence paragraph",
  rule: "LENGTH — one paragraph of 6 to 8 sentences. HARD CAP: 8 sentences, single paragraph."
};

// Base odds are 30% micro / 50% short / 20% paragraph. Reddit skews shorter
// (40/50/10). BiggerPockets uses the middle tier as its floor (0/70/30):
// one-line replies read as drive-bys on a forum where threads live for days.
export function pickLengthTier(
  platform: DiscussionPlatform,
  roll: number = Math.random()
): LengthTier {
  const [micro, short] = platform === "reddit" ? [0.4, 0.5] : [0, 0.7];
  if (roll < micro) return TIER_MICRO;
  if (roll < micro + short) return TIER_SHORT;
  return TIER_PARAGRAPH;
}

function discussionStyleSection(
  p: DrafterProfile,
  platform: DiscussionPlatform,
  tier: LengthTier,
  hasComments: boolean
): string {
  const pro = p.role === "realtor" ? "real estate" : "mortgage and real estate";
  const platformTone =
    platform === "reddit"
      ? "This is Reddit: casual, direct, zero polish. It should read like a comment typed on a phone by someone who knows what they're talking about."
      : "This is BiggerPockets: investor-to-investor, technical detail is welcome, still conversational.";

  const reactBlock = hasComments
    ? `THE THREAD ALREADY HAS A DISCUSSION. The top existing comments are included below the post. React to what commenters said instead of answering the original poster from scratch: agree with a specific take and add what it's missing, push back on one that's wrong, or say the thing every commenter missed. The reply should read like it was written by someone who read the whole thread, not just the title.`
    : platform === "biggerpockets"
      ? `The thread text below is crawled page text and may include replies from other users after the original post. If replies are present, treat them as the existing discussion and react to them (agree, push back, or add what everyone missed) instead of answering the original poster from scratch. If there are no replies, respond to the original poster directly.`
      : `No comments were captured for this thread, so respond to the original poster directly.`;

  return `
HOW TO WRITE THIS REPLY — this section overrides anything above about response structure, word counts, or credibility-weaving:

ONE POINT ONLY. First decide the single most valuable thing ${p.firstName} could add to this thread: the one point an experienced pro would actually bother to make. Then write ONLY that point. Do not answer every question the poster asked. Do not cover the topic comprehensively. Do not tack on a second point while you're at it. One point, made plainly, then stop.

${tier.rule}

${reactBlock}

Voice: ${p.firstName} is an experienced ${pro} professional with strong opinions who picks the one thing worth saying and says it plainly. Sentence fragments are fine. Starting a sentence with "And" or "But" is fine. Plain punctuation only: periods, commas, question marks, apostrophes, and the occasional parenthesis. ${platformTone}

Concrete detail: when the topic makes it natural, include one specific number or mechanic (a rate spread, a reserve requirement, months of cash-flow math, an LTV cap) instead of general advice. If no number fits naturally, skip it. Never invent a personal anecdote and never claim a specific past deal.

BANNED — the reply must not contain any of these:
- An opening that restates or validates the question. Nothing like "Great question", "Pretty common structure", "This is a common situation", or "A lot of people ask this". Start inside the point itself.
- A closing advice sentence. Nothing like "talk to an attorney", "consult a loan officer", or "worth running by a professional". End on the substance of the point.
- Any mention of loan officers, lenders, brokers, or financing services as a suggestion${platform === "reddit" ? " (Reddit especially — never do it there)" : ""}.
- Numbered lists, bullet points, headers, and em-dashes. Prose only.
- Symmetric hedging: no "on one hand... on the other", and no "it depends" as the whole answer. Pick a side.
- Semicolons, and colon-then-list constructions ("three things: a, b, c"). Plain sentences only.`.trim();
}

interface DiscussionContext {
  platform: DiscussionPlatform;
  tier: LengthTier;
  hasComments: boolean;
}

// Build the system prompt: role-specific base profile + (for Reddit/BP) the
// one-point discussion style + the platform contact rules + strict-sub
// overrides where applicable + the humanizer style rules.
function buildSystemPrompt(
  policy: ContactPolicy,
  platformLabel: string,
  p: DrafterProfile,
  redditPolicy: SubredditPolicy | null,
  discussion: DiscussionContext | null
): string {
  const base =
    p.role === "realtor"
      ? buildRealtorBaseProfile(p, !!discussion)
      : buildLoBaseProfile(p, !!discussion);
  const style = discussion
    ? `\n\n${discussionStyleSection(p, discussion.platform, discussion.tier, discussion.hasComments)}`
    : "";
  const strict = redditPolicy === "STRICT_NO_PROMO" ? `\n\n${strictNoPromoSection(p)}` : "";
  return `${base}${style}\n\n${contactSection(policy, platformLabel, p)}${strict}\n\n${HUMANIZER_RULES}`;
}

// ─── Drafting ────────────────────────────────────────────────────────────────

export interface DraftRequest {
  community: string;
  source: string;
  post_title: string;
  author: string;
  body: string;
  intent_tier: IntentTier;
  // Top scraped comments already on the thread (Reddit scout captures these).
  // When present, the discussion-style prompt reacts to them instead of
  // answering the OP from scratch.
  comments?: string[] | null;
}

export interface DraftResult {
  drafted_response: string;
  primary_intent: string;
  key_question: string;
  reason_selected: string;
  // Set by the post-generation sanitizer when the draft contains contact
  // info, credentials, or solicitation language. A non-null value means DO
  // NOT POST — the dashboard shows it as BLOCKED for manual rewrite.
  blocked_reason: string | null;
}

export async function draftResponse(
  req: DraftRequest,
  profile: DrafterProfile
): Promise<DraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  // Blocklist gate on the DRAFTING path — a blocked subreddit's post must
  // never be drafted, whatever upstream path let it through.
  if (isBlockedSubreddit(req.community, req.source)) {
    throw new Error(`Refusing to draft for blocklisted subreddit: ${req.source}`);
  }

  const client = new Anthropic({ apiKey });

  const policy = resolveContactPolicy(req.community, req.source, profile.role);
  const redditPolicy = leadRedditPolicy(req.community, req.source);
  const platformLabel = req.community || req.source || "community";

  // Reddit/BiggerPockets get the one-point discussion style; everything else
  // keeps the legacy comprehensive-answer prompt.
  const discussionPlatform = detectDiscussionPlatform(req.community, req.source);
  const comments = (req.comments || [])
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 5);
  const discussion: DiscussionContext | null = discussionPlatform
    ? {
        platform: discussionPlatform,
        tier: pickLengthTier(discussionPlatform),
        hasComments: comments.length > 0
      }
    : null;

  const system = buildSystemPrompt(policy, platformLabel, profile, redditPolicy, discussion);

  const commentsBlock =
    comments.length > 0
      ? `\n\nTop existing comments on the thread (in thread order):\n${comments
          .map((c, i) => `[Comment ${i + 1}] ${c.slice(0, 600)}`)
          .join("\n\n")}`
      : "";

  // In discussion mode, "chosen_point" comes before drafted_response so the
  // model commits to the single point before it starts writing the reply.
  const chosenPointLine = discussion
    ? `\n  "chosen_point": "<one sentence: the single most valuable point this reply will make>",`
    : "";

  const userPrompt = `
Community: ${req.community}
Source/Forum: ${req.source}
Tier: ${req.intent_tier}
Post title: ${req.post_title}
Author: ${req.author}

Post body:
"""
${req.body}
"""${commentsBlock}

Return a JSON object with these exact keys (no markdown fences, no commentary):
{
  "primary_intent": "<2-5 word label, e.g. 'DSCR lender referral' or 'First-time buyer prep'>",
  "key_question": "<short quote or paraphrase of what they're actually asking>",
  "reason_selected": "<one sentence on why this lead is worth ${profile.firstName}'s time>",${chosenPointLine}
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

  let result: DraftResult;
  try {
    // Pick fields explicitly — discussion mode adds a "chosen_point" scratch
    // key that must not ride along into the result.
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    result = {
      primary_intent: typeof parsed.primary_intent === "string" ? parsed.primary_intent : req.intent_tier,
      key_question: typeof parsed.key_question === "string" ? parsed.key_question : req.post_title,
      reason_selected:
        typeof parsed.reason_selected === "string" ? parsed.reason_selected : "Auto-captured by scout.",
      drafted_response: typeof parsed.drafted_response === "string" ? parsed.drafted_response : "",
      blocked_reason: null
    };
  } catch {
    // Fallback: stuff the whole text into drafted_response if JSON parsing fails.
    result = {
      primary_intent: req.intent_tier,
      key_question: req.post_title,
      reason_selected: "Auto-captured by scout.",
      drafted_response: cleaned,
      blocked_reason: null
    };
  }

  // Post-generation sanitizer — deterministic, runs regardless of what the
  // model produced. Reddit gets the full rule set (strict unless the sub is
  // explicitly STANDARD); BiggerPockets gets contact + solicitation rules.
  const sanitizerPlatform = discussionPlatform;
  if (sanitizerPlatform && result.drafted_response) {
    const check = sanitizeDraft(result.drafted_response, {
      platform: sanitizerPlatform,
      strict: sanitizerPlatform === "reddit" && redditPolicy !== "STANDARD",
      profile: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        company: profile.company || profile.brokerage,
        nmls: profile.nmls
      }
    });
    if (check.blocked) {
      result.blocked_reason = check.reasons.join("; ");
    }
  }

  return result;
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
