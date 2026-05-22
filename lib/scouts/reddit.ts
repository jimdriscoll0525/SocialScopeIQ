import type { ScoutResult } from "../types";

// National mortgage / real-estate subreddits only. Local subs (r/boston,
// r/massachusetts, ...) were dropped — they proved too noisy in testing.
const SUBREDDITS = [
  "FirstTimeHomeBuyer",
  "Mortgages",
  "RealEstate",
  "RealEstateInvesting",
  "Homeowners",
  "HomeBuying",
  "personalfinance"
];

// 48-hour freshness cutoff (matches the old Reddit scout + the Daily Lead
// Scout spec). With the read-last / trigger-next pattern below, the posts we
// read are typically 0–~48h old, so this trims anything that has aged out.
const CUTOFF_SECONDS = 60 * 60 * 48;

// Posts per subreddit. Maps to Apify `maxPostCount` (per-page); `maxItems` is
// the global dataset ceiling (subs * MAX_PER_SUB).
const MAX_PER_SUB = 25;

// --- Apify Reddit Scraper Lite — async read/trigger pattern ---------------
//
// Reddit 403s datacenter-IP scrapes (Vercel egress), so we delegate to Apify,
// which routes through residential proxies. BUT a full 7-subreddit run takes
// ~7 minutes — far beyond the route's 300s maxDuration (and Apify's own
// run-sync 300s cap) — so we CANNOT run it synchronously.
//
// Instead, each invocation:
//   1. READS the dataset of the most recent *completed* run and returns it
//      (an instant API read), then
//   2. TRIGGERS a fresh run asynchronously for the next cycle (returns as soon
//      as Apify accepts the run; we never wait for the ~7-min scrape to finish).
//
// Net effect: Reddit leads lag ~1 cron cycle (~24h), which is inside the 48h
// freshness window. run-scout.ts de-dupes by post_url, so re-reading the same
// dataset before a new run completes never double-drafts; and if runs stop
// succeeding, the 48h cutoff eventually empties the result rather than
// re-surfacing stale leads. Everything lives in this file — no schema or
// pipeline changes.
//
// Auth: APIFY_API_TOKEN (Bearer). Every failure logs and yields [] / a no-op,
// so the other scouts (BiggerPockets, Stack Exchange) always still run.
const ACTOR_ID = "trudax~reddit-scraper-lite";
const API_BASE = "https://api.apify.com/v2";

// Don't start a new run if one started within this window. Keeps the daily
// cron to ~one run/day and stops the manual "Find new posts" button (which
// also calls scoutReddit) from spawning duplicate paid runs on repeat clicks.
const TRIGGER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

// Hard timeout per Apify API call so a hung request can't stall the cron.
// These are lightweight calls (list run / read dataset / start run), so 30s
// is ample — none of them wait for the actual scrape.
const API_TIMEOUT_MS = 30 * 1000;

// Shape of a post item in the actor's dataset. All fields optional — we
// validate defensively rather than trust the upstream schema.
interface ApifyRedditPost {
  dataType?: string;      // "post" | "comment" | "community" | "user"
  title?: string;
  body?: string;
  username?: string;      // author handle (Apify uses `username`, not `author`)
  url?: string;
  communityName?: string; // e.g. "r/Mortgages"
  createdAt?: string;     // ISO 8601
  over18?: boolean;
  isAd?: boolean;
}

// The actor input used when we kick off a run. Async, so the ~7-min wall-clock
// time no longer competes with our function budget.
function buildInput() {
  return {
    startUrls: SUBREDDITS.map((s) => ({ url: `https://www.reddit.com/r/${s}/new/` })),
    sort: "new",
    skipComments: true,
    skipUserPosts: true,
    skipCommunity: true,
    searchPosts: true,
    searchComments: false,
    searchCommunities: false,
    searchUsers: false,
    maxPostCount: MAX_PER_SUB,
    maxItems: SUBREDDITS.length * MAX_PER_SUB,
    includeNSFW: false, // actor defaults this to true — opt out explicitly
    proxy: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] }
  };
}

// Authenticated Apify call with a hard timeout. Returns parsed JSON, or null on
// any failure (non-2xx, timeout, network, bad JSON). Never throws.
async function apifyJson(token: string, path: string, init?: RequestInit): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers || {})
      },
      signal: controller.signal,
      next: { revalidate: 0 }
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[reddit] Apify ${init?.method || "GET"} ${path} -> ${res.status}: ${detail.slice(0, 200)}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[reddit] Apify ${init?.method || "GET"} ${path} failed:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Map one Apify post to a ScoutResult, preserving the data shape the old Reddit
// scout produced: community = "Reddit" (platform), source = the sub (e.g.
// "r/Mortgages"). The state filter, drafter, and dashboard all key off this
// shape, so keeping it identical means no downstream changes.
function toResult(p: ApifyRedditPost): ScoutResult | null {
  if (!p.url || !p.title) return null;
  const createdMs = p.createdAt ? Date.parse(p.createdAt) : NaN;
  const posted_at = Number.isNaN(createdMs)
    ? new Date().toISOString()
    : new Date(createdMs).toISOString();
  return {
    post_url: p.url,
    post_title: p.title,
    author: p.username || "Unknown",
    community: "Reddit",
    source: p.communityName || "Reddit",
    body: p.body || "",
    posted_at
  };
}

// Read + map the dataset of the most recent SUCCEEDED run. [] if none exists
// yet (e.g. the very first deploy, before any run has completed).
async function readLastSucceededRun(token: string): Promise<ScoutResult[]> {
  const run = (await apifyJson(token, `/acts/${ACTOR_ID}/runs/last?status=SUCCEEDED`)) as
    | { data?: { defaultDatasetId?: string } | null }
    | null;
  const datasetId = run?.data?.defaultDatasetId;
  if (!datasetId) {
    console.warn("[reddit] no completed Apify run yet — returning none this cycle");
    return [];
  }

  const items = await apifyJson(token, `/datasets/${datasetId}/items?clean=true&limit=500`);
  if (!Array.isArray(items)) {
    console.warn("[reddit] dataset items were not an array — returning none");
    return [];
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const results = (items as ApifyRedditPost[])
    .filter((p) => p.dataType === undefined || p.dataType === "post")
    .filter((p) => !p.over18 && !p.isAd)
    .map(toResult)
    .filter((r): r is ScoutResult => r !== null)
    .filter((r) => {
      const created = Math.floor(Date.parse(r.posted_at) / 1000);
      return Number.isNaN(created) || nowSeconds - created <= CUTOFF_SECONDS;
    });

  console.log(`[reddit] read ${results.length} fresh posts from dataset ${datasetId} (of ${items.length} items)`);
  return results;
}

// Start a fresh async run for the next cycle — unless one is already in
// progress, or a run started within the cooldown window. Best-effort: any
// failure is a no-op (we still returned this cycle's results from the read).
async function maybeTriggerRun(token: string): Promise<void> {
  const last = (await apifyJson(token, `/acts/${ACTOR_ID}/runs/last`)) as
    | { data?: { status?: string; startedAt?: string } | null }
    | null;
  const data = last?.data;
  if (data) {
    if (data.status === "RUNNING" || data.status === "READY") {
      return; // a run is already in flight — don't stack another
    }
    const startedAt = data.startedAt ? Date.parse(data.startedAt) : 0;
    if (startedAt && Date.now() - startedAt < TRIGGER_COOLDOWN_MS) {
      return; // ran recently — avoid a duplicate paid run
    }
  }

  const started = await apifyJson(token, `/acts/${ACTOR_ID}/runs`, {
    method: "POST",
    body: JSON.stringify(buildInput())
  });
  if (started) console.log("[reddit] kicked off a new Apify run for next cycle");
}

export async function scoutReddit(): Promise<ScoutResult[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn("[reddit] APIFY_API_TOKEN not set — skipping Reddit");
    return [];
  }

  try {
    const results = await readLastSucceededRun(token);
    await maybeTriggerRun(token); // fast — returns once Apify accepts the run
    return results;
  } catch (err) {
    // Defensive backstop: the helpers already swallow their own errors, but
    // never let Reddit throw and disrupt the rest of the scout pipeline.
    console.warn("[reddit] unexpected failure:", err);
    return [];
  }
}
