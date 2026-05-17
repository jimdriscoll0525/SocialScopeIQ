import type { ScoutResult } from "../types";

// BiggerPockets forum IDs that produce mortgage/financing leads.
// These are scraped from the HTML thread index (BP has no public API).
const FORUMS = [
  { id: 22, name: "Mortgage Brokers & Lenders" },
  { id: 49, name: "Private & Conventional Lending" },
  { id: 50, name: "Creative Real Estate Financing" },
  { id: 311, name: "Buying & Selling Real Estate" },
  { id: 517, name: "Rental Property Investing" },
  { id: 12, name: "Starting Out" },
  { id: 564, name: "Massachusetts Real Estate" },
  { id: 693, name: "Boston Real Estate" }
];

const CUTOFF_MS = 1000 * 60 * 60 * 48;

// BP forum pages render thread links as
//   /forums/<forumId>/topics/<threadId>-<slug>
// We extract them with a regex against the listing HTML.
const THREAD_LINK_RE = /\/forums\/\d+\/topics\/(\d+)-([a-z0-9-]+)/gi;

async function fetchForumIndex(forumId: number): Promise<string[]> {
  const url = `https://www.biggerpockets.com/forums/${forumId}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "socialscopeiq/0.1" },
    next: { revalidate: 0 }
  });
  if (!res.ok) {
    console.warn(`[bp] forum ${forumId} returned ${res.status}`);
    return [];
  }
  const html = await res.text();
  const links = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = THREAD_LINK_RE.exec(html))) {
    links.add(`https://www.biggerpockets.com/forums/${forumId}/topics/${m[1]}-${m[2]}`);
  }
  return Array.from(links).slice(0, 15);
}

const THREAD_TITLE_RE = /<title>(.*?)<\/title>/i;
const THREAD_AUTHOR_RE = /class="forum-post__author[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i;
const THREAD_DATE_RE = /<time[^>]+datetime="([^"]+)"/i;
const THREAD_BODY_RE = /class="forum-post__body[^>]*>([\s\S]{0,3000}?)<\/(?:div|section)>/i;
const HTML_TAG_RE = /<[^>]+>/g;

async function fetchThread(url: string, forumName: string): Promise<ScoutResult | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "socialscopeiq/0.1" },
    next: { revalidate: 0 }
  });
  if (!res.ok) return null;
  const html = await res.text();

  const title = (html.match(THREAD_TITLE_RE)?.[1] || "").replace(/\s*\|\s*BiggerPockets.*$/i, "").trim();
  const author = html.match(THREAD_AUTHOR_RE)?.[1]?.trim() || "Unknown";
  const dateStr = html.match(THREAD_DATE_RE)?.[1];
  const bodyRaw = html.match(THREAD_BODY_RE)?.[1] || "";
  const body = bodyRaw.replace(HTML_TAG_RE, " ").replace(/\s+/g, " ").trim().slice(0, 2000);

  if (!title) return null;

  // 48-hour filter.
  const posted = dateStr ? new Date(dateStr) : new Date();
  if (Date.now() - posted.getTime() > CUTOFF_MS) return null;

  return {
    post_url: url,
    post_title: title,
    author,
    community: "BiggerPockets",
    source: forumName,
    body,
    posted_at: posted.toISOString()
  };
}

export async function scoutBiggerPockets(): Promise<ScoutResult[]> {
  const all: ScoutResult[] = [];
  for (const f of FORUMS) {
    try {
      const links = await fetchForumIndex(f.id);
      for (const link of links) {
        const t = await fetchThread(link, f.name);
        if (t) all.push(t);
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      console.warn(`[bp] ${f.name} failed:`, err);
    }
  }
  return all;
}
