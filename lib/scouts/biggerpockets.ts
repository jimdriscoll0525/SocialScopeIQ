import type { ScoutResult } from "../types";

// BiggerPockets forums that produce mortgage/financing leads, in CRAWL-PRIORITY
// order: the in-state MA/Boston forums first (they auto-tag to MA via the state
// filter and are highest value), then the national forums that empirically
// produce the most TIER 1 financing leads. Order matters because the crawler is
// breadth-first under a page cap — earlier forums get covered first. An explicit
// array is used (not an object) because integer-keyed objects iterate in numeric
// order, which would ignore this priority.
// The MA/Boston names MUST match lib/state-filter.ts FORUM_TO_STATE exactly.
const FORUMS: { id: number; name: string }[] = [
  { id: 564, name: "Massachusetts Real Estate" },
  { id: 693, name: "Boston Real Estate" },
  { id: 22, name: "Mortgage Brokers & Lenders" },
  { id: 49, name: "Private & Conventional Lending" },
  { id: 50, name: "Creative Real Estate Financing" },
  { id: 311, name: "Buying & Selling Real Estate" },
  { id: 517, name: "Rental Property Investing" },
  { id: 12, name: "Starting Out" }
];
const FORUM_NAMES: Record<number, string> = Object.fromEntries(FORUMS.map((f) => [f.id, f.name]));

// 7-day freshness window. BiggerPockets is slow-moving evergreen Q&A (threads
// stay live for days), unlike Reddit's fast feed — a 48h cutoff would yield ~0.
// The date we extract is the thread's most-recent-activity date (best we can
// parse from the page text), which is a fair proxy for "still a live lead".
const CUTOFF_MS = 7 * 24 * 60 * 60 * 1000;

// --- Apify website-content-crawler — async read/trigger pattern ------------
//
// BiggerPockets 403s datacenter IPs and has no public API, and there is NO
// purpose-built BP actor on Apify. So we use the general-purpose
// apify/website-content-crawler with a browser + residential proxy: it gets
// past the block and returns clean readable text per page, which is robust to
// BP's markup drift (no CSS selectors to break, unlike the old HTML scraper).
//
// A full 8-forum crawl (~120 pages) takes minutes, past the 300s function
// budget, so we use the SAME read-last / trigger-next pattern as the Reddit
// scout: each invocation reads the most recent completed crawl's dataset and
// kicks off a fresh crawl for next time. BP leads lag ~1 cron cycle, well
// within the 7-day window. run-scout.ts de-dupes by post_url. Everything lives
// in this file; any failure logs and yields []/a no-op so other scouts run.
//
// Auth: APIFY_API_TOKEN (Bearer).
const ACTOR_ID = "apify~website-content-crawler";
const API_BASE = "https://api.apify.com/v2";
const TRIGGER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h — one crawl/day; suppress dup runs
const API_TIMEOUT_MS = 30 * 1000;               // per Apify API call (none wait for the crawl)

// A crawled page from website-content-crawler. Fields are best-effort.
interface WccItem {
  url?: string;
  text?: string;
  metadata?: { title?: string };
}

// Matches a BP thread URL and captures forumId + threadId. Also serves as the
// "is this really a BP thread?" guard (skips the forum index + any stray page).
const THREAD_RE = /biggerpockets\.com\/forums\/(\d+)\/topics\/(\d+)-/i;

function buildInput() {
  return {
    startUrls: FORUMS.map((f) => ({ url: `https://www.biggerpockets.com/forums/${f.id}` })),
    crawlerType: "playwright:firefox", // browser — needed to get past BP's bot defenses
    maxCrawlDepth: 1,                   // forum index -> thread pages
    maxCrawlPages: 60,                  // ~6-7 threads/forum; browser+residential ~13s/page,
                                        // so this keeps a crawl to ~10min and bounds cost.
                                        // Qualifying BP leads are rare, so depth here is plenty.
    includeUrlGlobs: ["**/forums/*/topics/**"], // only follow thread links
    proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
    saveMarkdown: false
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
      console.warn(`[bp] Apify ${init?.method || "GET"} ${path} -> ${res.status}: ${detail.slice(0, 200)}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[bp] Apify ${init?.method || "GET"} ${path} failed:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// website-content-crawler sometimes doubles the page title ("FooFoo") and
// appends " | BiggerPockets". Strip the suffix, then collapse exact doubling.
function cleanTitle(raw: string): string {
  let t = raw.replace(/\s*\|\s*BiggerPockets.*$/i, "").trim();
  // Collapse a title the crawler doubled, with OR without a separating space
  // ("FooFoo" → even length; "Foo Foo" → odd length, skip the 1 middle char).
  if (t.length > 1) {
    const half = Math.floor(t.length / 2);
    const first = t.slice(0, half);
    const second = t.length % 2 === 0 ? t.slice(half) : t.slice(half + 1);
    if (first.length > 0 && first === second) t = first.trim();
  }
  return t;
}

// Best-effort post date from the page text, e.g. "Updated 9 days ago on
// 05/13/2026". Falls back to now (so unparseable dates are treated as fresh).
function parsePostedAt(text: string): string {
  const m = text.match(/on (\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

// Map one crawled page to a ScoutResult. Returns null for non-thread pages
// (forum index, non-BP urls) and for pagination duplicates of a thread we've
// already mapped (dedupe by threadId via the shared `seen` set).
function toResult(item: WccItem, seen: Set<string>): ScoutResult | null {
  const url = item.url;
  if (!url) return null;
  const m = url.match(THREAD_RE);
  if (!m) return null; // forum index, or not a BiggerPockets thread

  const forumId = Number(m[1]);
  const threadId = m[2];
  if (seen.has(threadId)) return null; // ?page=N variant of an already-seen thread
  seen.add(threadId);

  const title = cleanTitle(item.metadata?.title || "");
  if (!title) return null;

  return {
    post_url: url.split("?")[0], // canonical, drop ?page=
    post_title: title,
    author: "Unknown", // BP doesn't expose a clean author handle in the page text
    community: "BiggerPockets",
    source: FORUM_NAMES[forumId] || "BiggerPockets Forum",
    body: (item.text || "").replace(/\s+/g, " ").trim().slice(0, 2000),
    posted_at: parsePostedAt(item.text || "")
  };
}

// Read + map the dataset of the most recent SUCCEEDED crawl. [] if none yet.
async function readLastSucceededRun(token: string): Promise<ScoutResult[]> {
  const run = (await apifyJson(token, `/acts/${ACTOR_ID}/runs/last?status=SUCCEEDED`)) as
    | { data?: { defaultDatasetId?: string } | null }
    | null;
  const datasetId = run?.data?.defaultDatasetId;
  if (!datasetId) {
    console.warn("[bp] no completed crawl yet — returning none this cycle");
    return [];
  }

  const items = await apifyJson(token, `/datasets/${datasetId}/items?clean=true&limit=500`);
  if (!Array.isArray(items)) {
    console.warn("[bp] dataset items were not an array — returning none");
    return [];
  }

  const cutoffMs = Date.now() - CUTOFF_MS;
  const seen = new Set<string>();
  const results: ScoutResult[] = [];
  for (const item of items as WccItem[]) {
    const r = toResult(item, seen);
    if (!r) continue;
    if (Date.parse(r.posted_at) < cutoffMs) continue; // older than the 7-day window
    results.push(r);
  }

  console.log(`[bp] read ${results.length} fresh threads from dataset ${datasetId} (of ${items.length} pages)`);
  return results;
}

// Start a fresh crawl for next cycle — unless one is in progress or a crawl
// started within the cooldown window. Best-effort; failures are no-ops.
async function maybeTriggerRun(token: string): Promise<void> {
  const last = (await apifyJson(token, `/acts/${ACTOR_ID}/runs/last`)) as
    | { data?: { status?: string; startedAt?: string } | null }
    | null;
  const data = last?.data;
  if (data) {
    if (data.status === "RUNNING" || data.status === "READY") return; // already in flight
    const startedAt = data.startedAt ? Date.parse(data.startedAt) : 0;
    if (startedAt && Date.now() - startedAt < TRIGGER_COOLDOWN_MS) return; // ran recently
  }

  const started = await apifyJson(token, `/acts/${ACTOR_ID}/runs`, {
    method: "POST",
    body: JSON.stringify(buildInput())
  });
  if (started) console.log("[bp] kicked off a new crawl for next cycle");
}

export async function scoutBiggerPockets(): Promise<ScoutResult[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn("[bp] APIFY_API_TOKEN not set — skipping BiggerPockets");
    return [];
  }

  try {
    const results = await readLastSucceededRun(token);
    await maybeTriggerRun(token); // fast — returns once Apify accepts the run
    return results;
  } catch (err) {
    // Defensive backstop: helpers already swallow errors; never let BP throw
    // and disrupt the rest of the scout pipeline.
    console.warn("[bp] unexpected failure:", err);
    return [];
  }
}
