import type { ScoutResult } from "../types";

// Stack Exchange has a free, generous API at api.stackexchange.com.
// We query the "money" site (money.stackexchange.com — Personal Finance &
// Money) across several mortgage/financing-relevant tags.
//
// Note: the API's `tagged=a;b` is an AND filter, so to broaden coverage we
// issue one request per tag and de-duplicate by question_id. Unknown tags
// just return an empty list (no error), so the tag set is safe to tune.
//
// With Reddit gated behind Reddit's Responsible Builder approval and
// BiggerPockets disabled, this is the primary working lead source — hence
// the wider tag coverage. An optional STACKEXCHANGE_API_KEY raises the
// daily quota 300 -> 10,000 and avoids shared-datacenter-IP throttling;
// it is optional and the scout works without it.
const SITE = "money";
const TAGS = [
  "mortgage",
  "loans",
  "home-loan",
  "first-time-home-buyer",
  "refinance",
  "real-estate",
  "down-payment",
  "heloc"
];
const CUTOFF_SECONDS = 60 * 60 * 48;

interface SEItem {
  question_id: number;
  title: string;
  body_markdown?: string;
  body?: string;
  owner?: { display_name?: string };
  link: string;
  creation_date: number;
  tags: string[];
}

interface SEResponse {
  items?: SEItem[];
  backoff?: number;
  error_message?: string;
}

function toResult(q: SEItem, tag: string): ScoutResult {
  return {
    post_url: q.link,
    post_title: q.title,
    author: q.owner?.display_name || "Unknown",
    community: "Stack Exchange",
    source: `${SITE}.stackexchange.com — ${tag} tag`,
    body: (q.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000),
    posted_at: new Date(q.creation_date * 1000).toISOString()
  };
}

export async function scoutStackExchange(): Promise<ScoutResult[]> {
  const since = Math.floor(Date.now() / 1000) - CUTOFF_SECONDS;
  const key = process.env.STACKEXCHANGE_API_KEY;
  const keyParam = key ? `&key=${encodeURIComponent(key)}` : "";

  const seen = new Set<number>();
  const out: ScoutResult[] = [];

  for (const tag of TAGS) {
    const url =
      `https://api.stackexchange.com/2.3/questions?` +
      `order=desc&sort=creation&site=${SITE}&tagged=${encodeURIComponent(tag)}` +
      `&fromdate=${since}&pagesize=50&filter=withbody${keyParam}`;

    try {
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) {
        console.warn(`[stackexchange] tag "${tag}" returned ${res.status}`);
        continue;
      }
      const json = (await res.json()) as SEResponse;
      if (json.error_message) {
        console.warn(`[stackexchange] tag "${tag}" error: ${json.error_message}`);
        continue;
      }
      for (const q of json.items || []) {
        if (seen.has(q.question_id)) continue; // question may carry multiple tags
        seen.add(q.question_id);
        out.push(toResult(q, tag));
      }
      // Respect SE's throttle signal (cap so we never hang the function).
      if (json.backoff && json.backoff > 0) {
        if (json.backoff > 5) {
          console.warn(`[stackexchange] backoff ${json.backoff}s requested — stopping early`);
          break;
        }
        await new Promise((r) => setTimeout(r, json.backoff! * 1000));
      } else {
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      console.warn(`[stackexchange] tag "${tag}" failed:`, err);
    }
  }

  return out;
}
