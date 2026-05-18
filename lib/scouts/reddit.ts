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

// Reddit blocks the unauthenticated www.reddit.com/.json endpoints from
// datacenter IPs (Vercel) since late 2025 — they return 403 there even though
// they work from residential IPs. The official OAuth API (oauth.reddit.com)
// is authenticated and works from datacenter IPs, so we use app-only
// (client_credentials) OAuth. This needs a free Reddit "script" app:
//   reddit.com/prefs/apps  ->  REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET
// If those env vars are absent or auth fails, scoutReddit degrades to []
// (same as the old failure behavior) — it never throws.
const REDDIT_UA = "web:socialscopeiq:v0.1 (by /u/jim-driscoll)";
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_BASE = "https://oauth.reddit.com";

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

// Module-scoped token cache. Reddit app-only tokens last ~1h; we refresh
// with a 60s safety margin. Cache survives across subs within one run
// (and across runs while the lambda instance is warm).
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) {
    console.warn("[reddit] REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET not set — skipping Reddit");
    return null;
  }

  try {
    const basic = Buffer.from(`${id}:${secret}`).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": REDDIT_UA
      },
      body: "grant_type=client_credentials",
      next: { revalidate: 0 }
    });
    if (!res.ok) {
      console.warn(`[reddit] token request returned ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
      console.warn("[reddit] token response missing access_token");
      return null;
    }
    const ttlMs = Math.max(((json.expires_in ?? 3600) - 60), 60) * 1000;
    cachedToken = { token: json.access_token, expiresAt: Date.now() + ttlMs };
    return cachedToken.token;
  } catch (err) {
    console.warn("[reddit] token request failed:", err);
    return null;
  }
}

async function fetchSub(sub: string, token: string): Promise<ScoutResult[]> {
  const url = `${API_BASE}/r/${sub}/new?limit=50`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": REDDIT_UA
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
  const token = await getAccessToken();
  if (!token) return [];

  const all: ScoutResult[] = [];
  for (const sub of SUBS) {
    try {
      const posts = await fetchSub(sub, token);
      all.push(...posts);
    } catch (err) {
      console.warn(`[reddit] r/${sub} failed:`, err);
    }
    // Small delay to stay well under the OAuth rate limit.
    await new Promise((r) => setTimeout(r, 500));
  }
  return all;
}
