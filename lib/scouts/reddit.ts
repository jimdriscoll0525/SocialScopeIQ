import type { ScoutResult } from "../types";

// Subreddits to monitor. Edit to taste.
// Mix of national mortgage forums + MA/Boston/local for high-signal local leads.
const SUBS = [
  "Mortgages",
  "FirstTimeHomeBuyer",
  "RealEstate",
  "RealEstateInvesting",
  "REI",
  "personalfinance",
  "boston",
  "massachusetts",
  "CambridgeMA"
];

// 48-hour cutoff in seconds (matches the Daily Lead Scout spec).
const CUTOFF_SECONDS = 60 * 60 * 48;

interface RedditPost {
  data: {
    title: string;
    selftext: string;
    author: string;
    permalink: string;
    created_utc: number;
    subreddit: string;
    stickied: boolean;
    over_18: boolean;
  };
}

interface RedditListing {
  data: { children: RedditPost[] };
}

async function fetchSub(sub: string): Promise<ScoutResult[]> {
  const url = `https://www.reddit.com/r/${sub}/new.json?limit=50`;
  const res = await fetch(url, {
    headers: {
      // Reddit asks for a descriptive User-Agent. Without one you'll get rate limited.
      "User-Agent": "socialscopeiq/0.1 by jim-driscoll"
    },
    next: { revalidate: 0 }
  });
  if (!res.ok) {
    console.warn(`[reddit] r/${sub} returned ${res.status}`);
    return [];
  }
  const json = (await res.json()) as RedditListing;
  const now = Math.floor(Date.now() / 1000);

  return json.data.children
    .map((c) => c.data)
    .filter((p) => !p.stickied && !p.over_18)
    .filter((p) => now - p.created_utc <= CUTOFF_SECONDS)
    .map((p) => ({
      post_url: `https://www.reddit.com${p.permalink}`,
      post_title: p.title,
      author: p.author,
      community: "Reddit",
      source: `r/${p.subreddit}`,
      body: p.selftext || "",
      posted_at: new Date(p.created_utc * 1000).toISOString()
    }));
}

export async function scoutReddit(): Promise<ScoutResult[]> {
  const all: ScoutResult[] = [];
  for (const sub of SUBS) {
    try {
      const posts = await fetchSub(sub);
      all.push(...posts);
    } catch (err) {
      console.warn(`[reddit] r/${sub} failed:`, err);
    }
    // Small delay to be polite to Reddit's free tier.
    await new Promise((r) => setTimeout(r, 500));
  }
  return all;
}
