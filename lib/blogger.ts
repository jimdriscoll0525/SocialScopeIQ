import Anthropic from "@anthropic-ai/sdk";
import { HUMANIZER_RULES } from "./humanizer";
import { BLOG_MODEL } from "./config";
import { LO_FACT_CORRECTIONS, type DrafterProfile } from "./drafter";
import { imageChoices } from "./blog-images";
import { slugify } from "./slug";

// Long-form blog generation (Phase 5). One API call produces topic + title +
// meta description + markdown body. Posts are always born as drafts; the
// author publishes from the app after review.
//
// Output uses labeled lines + a --- divider instead of JSON because a
// 1000-word markdown body inside a JSON string is where parsing goes to die.

export interface BlogGenRequest {
  profile: DrafterProfile;
  topic?: string | null; // user-supplied custom topic; omit for auto
  existingTitles: string[]; // recent posts, so auto topics don't repeat
}

export interface BlogGenResult {
  topic: string;
  title: string;
  slug: string;
  meta_description: string;
  content_md: string;
}

export interface VideoBlogGenRequest {
  profile: DrafterProfile;
  script: string; // raw video script supplied by the author
  description?: string | null; // optional context about the video; never published
  existingTitles: string[];
}

export interface VideoBlogGenResult extends BlogGenResult {
  transcript: string; // cleaned-up script for the "Video Transcript" section
}

function territory(p: DrafterProfile): string {
  if (p.townsServed.length > 0 && p.statesServed.length > 0) {
    return `${p.townsServed.join(", ")} (${p.statesServed.join(", ")})`;
  }
  if (p.townsServed.length > 0) return p.townsServed.join(", ");
  if (p.statesServed.length > 0) return p.statesServed.join(", ");
  return "their local market";
}

function buildBlogSystemPrompt(p: DrafterProfile, mode: "article" | "video" = "article"): string {
  const name = `${p.firstName} ${p.lastName}`.trim();
  const isRealtor = p.role === "realtor";

  const persona = isRealtor
    ? `${name} is a real estate agent${p.brokerage ? ` with ${p.brokerage}` : ""} serving ${territory(p)}.`
    : `${name} is a mortgage loan officer${p.company ? ` with ${p.company}` : ""} serving ${territory(p)}.`;

  const complianceRules = isRealtor
    ? `
Compliance, never break:
- FAIR HOUSING: never characterize neighborhoods or towns by the demographics of the people who live there (race, ethnicity, religion, national origin, family status, disability), and never steer. Describe property, prices in general terms, process, commute, amenities, and lifestyle facts. For schools, point readers to objective sources (state report cards) rather than labeling schools or towns "good" or "bad".
- Never invent market statistics, comps, or sale prices. General, clearly-hedged observations are fine; fake precision is not.
- Never disparage other agents or brokerages.`
    : `
Compliance, never break:
- Never quote specific interest rates or APRs (they go stale and create compliance exposure). Describing how pricing works, what moves a rate up or down, and how to compare offers is encouraged.
- Never promise approval, and never guarantee outcomes.
- Program limits and numbers must be ones you are confident in; when a number varies by county or year (loan limits, DPA amounts), say so and tell readers how to check the current figure.

${LO_FACT_CORRECTIONS}`;

  // Video companion posts: the page embeds the author's YouTube video at the
  // top, so the article must add to it rather than restate it, and the model
  // also produces a reader-friendly transcript from the raw script.
  const videoJobs =
    mode === "video"
      ? `

This post accompanies a video recorded by ${name}, embedded at the top of the page. You are given the raw video script. Two jobs:
1. ARTICLE — write a post that COMPLEMENTS the video, never restates it. Go deeper on the numbers, add context the video skipped, cover the follow-up questions a viewer would have, and give concrete next steps. A reader who watched the video must learn new things here; a reader who skips the video must still get a complete standalone article. You may reference the video ("In the video above...") at most twice. For video companions, 700-1100 words is the target instead of the usual range.
2. CLEANED TRANSCRIPT — rewrite the script as a readable transcript: remove stage directions (e.g. [cut to b-roll]), camera and editor notes, filler words (um, uh, you know), sponsor reads, and calls to like or subscribe. Keep the substance and ${p.firstName}'s voice. Plain paragraphs only — no headings, no markdown formatting, and never invent content that isn't in the script.`
      : "";

  const outputFormat =
    mode === "video"
      ? `
Output format, exactly this structure (labeled header lines, then a line containing only ---, then the markdown article, then a line containing only ---TRANSCRIPT---, then the cleaned transcript; no other commentary):
TOPIC: <the topic in a few words>
TITLE: <post title, 50-65 characters, compelling but plain, no clickbait>
META: <meta description, 140-160 characters, plain summary that earns the click>
---
<the full markdown article body>
---TRANSCRIPT---
<the cleaned transcript, plain paragraphs>`
      : `
Output format, exactly this structure (labeled header lines, then a line containing only ---, then the markdown body; no other commentary):
TOPIC: <the topic in a few words>
TITLE: <post title, 50-65 characters, compelling but plain, no clickbait>
META: <meta description, 140-160 characters, plain summary that earns the click>
---
<the full markdown body>`;

  const photoRule =
    mode === "video"
      ? "Insert at most 1 photo (the embedded video is the visual anchor; most video posts need none)"
      : "Insert exactly 2 photos";

  return `
You are ghostwriting a blog post published under ${name}'s byline on their public professional page.

${persona}
About them, in their own words (match this voice; use only these facts for credibility, never invent more): ${p.voiceSample?.trim() || "An experienced professional."}
Specialties: ${p.niche?.trim() || (isRealtor ? "residential real estate" : "residential mortgage lending")}${videoJobs}

What a good post looks like:
- 900-1400 words of genuinely useful, specific guidance a reader could act on. Written for consumers (buyers, owners, investors), not for industry peers.
- Markdown. Use ## section headings (no top-level # heading; the title is rendered separately). Short paragraphs. Lists where they genuinely help.
- Local when it helps: mention the towns and states ${p.firstName} serves where genuinely relevant. This is a local-SEO page; a reader in ${territory(p)} should feel it was written for their market. Do not force locality into every section.
- Written from ${p.firstName}'s experience. First person is fine. Weave credibility in naturally, at most twice; never a sales pitch.
- Cite authoritative sources where they genuinely strengthen a claim: 1-3 inline markdown links per post to official government or consumer sites, placed on the sentence where the fact appears. Good examples: hud.gov (FHA), va.gov (VA loans), rd.usda.gov (USDA loans), consumerfinance.gov (CFPB consumer guidance), fanniemae.com / freddiemac.com (conforming guidelines), irs.gov (tax questions), fhfa.gov (loan limits), and official state agency sites. Only official/authoritative sites — never competitors, lead-gen sites, aggregators, or news articles. If you are not certain a deep URL exists, link the site's homepage or main topic page instead of guessing a path; a wrong link is worse than a general one.
- No contact information anywhere in the body: no phone, email, or invitation to call, and no URLs other than the authoritative reference links described above. The page template renders an author card with contact details under every post.
- End with a short practical wrap-up section, not a sales close. Do not sign the post or end with ${p.firstName}'s name; the byline and author card are rendered separately.

Visuals (the page template renders these; use them):
- ${photoRule} from this library — and ONLY this library, never any other image path or external URL — as standard markdown images, each on its own line between sections (never back-to-back, never in the first section; the page already has a hero photo at the top). Keep each image's listed alt text. Available photos:
${imageChoices().map((img) => `  ![${img.alt}](${img.path}) — good for: ${img.use}`).join("\n")}
- Markdown tables are supported and styled. When the post compares options, tiers, or steps side by side, prefer a small table (2-4 columns) over a long paragraph.
- A simple bar chart is available: a fenced code block with the language tag "chart" containing JSON like {"title": "...", "unit": "$", "bars": [{"label": "Year 1", "value": 2684}, {"label": "Year 2", "value": 2998}], "footnote": "Example for illustration only, not a quote."}. Include at most one chart, and only when the post naturally contains 2-6 comparable numbers you are confident in (loan limits, down payment tiers, example payments). Every chart built on example dollar amounts must carry that exact "Example for illustration only" footnote. Never chart interest rates or APRs. If no such numbers fit the topic, no chart — most posts won't have one.
${complianceRules}

${HUMANIZER_RULES}
${outputFormat}
`.trim();
}

function buildBlogUserPrompt(req: BlogGenRequest): string {
  const { profile: p, topic, existingTitles } = req;
  const existing =
    existingTitles.length > 0
      ? `\n\nAlready published or drafted (pick something clearly different; do not rehash these):\n${existingTitles
          .slice(0, 30)
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  if (topic?.trim()) {
    return `Write the post on this topic: ${topic.trim()}${existing}`;
  }

  return `Choose one strong topic yourself, then write the post.

Good topic sources: ${p.firstName}'s specialties, common questions their clients ask, seasonal timing, and local angles for ${territory(p)}. Pick the topic a real reader in that market would search for this month.${existing}`;
}

// Parse the labeled-lines-plus-divider format. Falls back sanely if the model
// drifts: body = everything after ---, or the whole text if no divider.
function parseBlogOutput(text: string, fallbackTopic: string): Omit<BlogGenResult, "slug"> {
  const divider = text.indexOf("\n---");
  const head = divider >= 0 ? text.slice(0, divider) : "";
  const body = divider >= 0 ? text.slice(divider + 4).replace(/^-*\s*/, "").trim() : text.trim();

  const grab = (label: string) =>
    head.match(new RegExp(`^${label}:\\s*(.+)$`, "m"))?.[1].trim() || "";

  const title = grab("TITLE") || body.match(/^#+\s*(.+)$/m)?.[1].trim() || fallbackTopic;
  return {
    topic: grab("TOPIC") || fallbackTopic,
    title,
    meta_description: grab("META") || "",
    content_md: body
  };
}

async function callBlogModel(
  system: string,
  user: string,
  maxTokens: number
): Promise<{ text: string; truncated: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });

  // BLOG_MODEL defaults to Opus 5, which rejects `temperature` — don't send one.
  const msg = await client.messages.create({
    model: BLOG_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }]
  });

  const text = msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return { text, truncated: msg.stop_reason === "max_tokens" };
}

export async function generateBlogPost(req: BlogGenRequest): Promise<BlogGenResult> {
  const { text } = await callBlogModel(
    buildBlogSystemPrompt(req.profile),
    buildBlogUserPrompt(req),
    8000
  );

  const parsed = parseBlogOutput(text, req.topic?.trim() || "mortgage guidance");
  if (!parsed.content_md) throw new Error("Blog generation returned an empty body");

  return { ...parsed, slug: slugify(parsed.title) };
}

function buildVideoBlogUserPrompt(req: VideoBlogGenRequest): string {
  const existing =
    req.existingTitles.length > 0
      ? `\n\nAlready published or drafted (pick a clearly different title; do not rehash these):\n${req.existingTitles
          .slice(0, 30)
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";
  const description = req.description?.trim()
    ? `\n\nVideo description (context only — none of this is spoken in the video: use it to inform the article, and never include any of it in the transcript):\n${req.description.trim()}`
    : "";
  return `Here is the raw video script:\n\n${req.script}${description}\n\nWrite the companion article and the cleaned transcript.${existing}`;
}

export async function generateVideoBlogPost(req: VideoBlogGenRequest): Promise<VideoBlogGenResult> {
  // 16k output tokens: the article plus a cleaned transcript of a long video
  // won't fit in the 8k used for text posts.
  const { text, truncated } = await callBlogModel(
    buildBlogSystemPrompt(req.profile, "video"),
    buildVideoBlogUserPrompt(req),
    16000
  );
  if (truncated) {
    throw new Error("The script is too long to process in one pass — trim it and try again.");
  }

  // Split the transcript off before reusing parseBlogOutput so its "\n---"
  // divider logic only ever sees the header + article. Tolerant of dash-count
  // and spacing drift around the delimiter.
  const delim = text.match(/\n-{2,}\s*TRANSCRIPT\s*-{2,}\s*\n/i);
  if (!delim || delim.index === undefined) {
    throw new Error("Generation didn't return a transcript — try again.");
  }
  const transcript = text.slice(delim.index + delim[0].length).trim();
  const parsed = parseBlogOutput(text.slice(0, delim.index), "video companion post");
  if (!parsed.content_md || !transcript) {
    throw new Error("Generation returned an incomplete post — try again.");
  }

  return { ...parsed, slug: slugify(parsed.title), transcript };
}
