import type { ScoutResult } from "../types";

// Stack Exchange has a free, generous API at api.stackexchange.com.
// We query the "money" site (money.stackexchange.com) for the "mortgage" tag.
const SITE = "money";
const TAG = "mortgage";
const CUTOFF_SECONDS = 60 * 60 * 48;

interface SEItem {
  question_id: number;
  title: string;
  body_markdown?: string;
  body?: string;
  owner: { display_name: string };
  link: string;
  creation_date: number;
  tags: string[];
}

interface SEResponse {
  items: SEItem[];
}

export async function scoutStackExchange(): Promise<ScoutResult[]> {
  const since = Math.floor(Date.now() / 1000) - CUTOFF_SECONDS;
  const url =
    `https://api.stackexchange.com/2.3/questions?` +
    `order=desc&sort=creation&site=${SITE}&tagged=${TAG}` +
    `&fromdate=${since}&pagesize=30&filter=withbody`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    console.warn(`[stackexchange] returned ${res.status}`);
    return [];
  }
  const json = (await res.json()) as SEResponse;

  return json.items.map((q) => ({
    post_url: q.link,
    post_title: q.title,
    author: q.owner?.display_name || "Unknown",
    community: "Stack Exchange",
    source: "money.stackexchange.com — mortgage tag",
    body: (q.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000),
    posted_at: new Date(q.creation_date * 1000).toISOString()
  }));
}
