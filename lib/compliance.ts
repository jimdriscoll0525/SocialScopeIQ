// Subreddit compliance policy. Born from a permanent ban on r/personalfinance
// (Rule 2: self-promotion) after a drafted reply carried a promotional profile
// line. Three levels:
//
//   BLOCKED          never scrape, never ingest, never draft.
//   STRICT_NO_PROMO  helpful answers only — no credentials, no title, no
//                    years-of-experience, sanitizer in strict mode.
//   STANDARD         current behavior minus contact info (local/geo subs where
//                    a light personal touch is tolerated).
//
// UNKNOWN SUBREDDITS DEFAULT TO STRICT_NO_PROMO — never STANDARD. Adding a new
// sub to the scraper without adding it here keeps it maximally conservative.

export type SubredditPolicy = "BLOCKED" | "STRICT_NO_PROMO" | "STANDARD";

// Case-insensitive by construction: keys are lowercase, lookups normalize.
const SUBREDDIT_POLICIES: Record<string, SubredditPolicy> = {
  // Permanently banned — never touch again.
  personalfinance: "BLOCKED",

  // Finance/advice subs: strict.
  mortgages: "STRICT_NO_PROMO",
  firsttimehomebuyer: "STRICT_NO_PROMO",
  firsttimehomebuyers: "STRICT_NO_PROMO",
  newbhomebuyer: "STRICT_NO_PROMO",
  homeloans: "STRICT_NO_PROMO",
  heloc: "STRICT_NO_PROMO",
  realestate: "STRICT_NO_PROMO",
  realestateinvesting: "STRICT_NO_PROMO",
  homeowners: "STRICT_NO_PROMO",
  homebuying: "STRICT_NO_PROMO",

  // Local/geo + lifestyle subs: standard (still contact-free like all Reddit).
  boston: "STANDARD",
  massachusetts: "STANDARD",
  newhampshire: "STANDARD",
  samegrassbutgreener: "STANDARD"
};

export const BLOCKED_SUBREDDITS: string[] = Object.entries(SUBREDDIT_POLICIES)
  .filter(([, p]) => p === "BLOCKED")
  .map(([name]) => name);

// "r/Mortgages", "R/mortgages/", " mortgages " -> "mortgages"
export function normalizeSubreddit(source: string): string {
  return (source || "")
    .trim()
    .replace(/^\/?r\//i, "")
    .replace(/\/+$/, "")
    .trim()
    .toLowerCase();
}

export function subredditPolicy(source: string): SubredditPolicy {
  return SUBREDDIT_POLICIES[normalizeSubreddit(source)] ?? "STRICT_NO_PROMO";
}

function isRedditish(community: string, source: string): boolean {
  return /reddit|^\/?r\//i.test(`${community} ${source}`);
}

// The single blocklist check used by the scraper input, the ingestion path,
// and the drafting path. Case-insensitive.
export function isBlockedSubreddit(community: string, source: string): boolean {
  if (!isRedditish(community, source)) return false;
  return subredditPolicy(source) === "BLOCKED";
}

// Policy for a lead, given how leads store platform fields (community =
// "Reddit", source = "r/<sub>"). Non-Reddit content has no subreddit policy.
export function leadRedditPolicy(
  community: string | null,
  source: string | null
): SubredditPolicy | null {
  if (!isRedditish(community || "", source || "")) return null;
  return subredditPolicy(source || "");
}
