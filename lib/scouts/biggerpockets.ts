import type { ScoutResult } from "../types";

// BiggerPockets scout — DISABLED 2026-05.
//
// Why: As of May 2026 BiggerPockets returns HTTP 403 to requests from
// Vercel's datacenter IP range (it serves 200 only to residential IPs),
// AND it has redesigned its thread markup so the previous
// `forum-post__author` / `forum-post__body` selectors no longer match.
// BiggerPockets has no public API, so there is no minimal fix: restoring
// it would require a scraping proxy (alternate egress IP) PLUS a full
// thread-parser rewrite against the new markup. Tracked as separate work.
//
// This no-op keeps the scout wired into /api/scout's Promise.allSettled —
// it contributes zero leads instead of 403 noise and wasted function time.
//
// To re-enable: restore the HTML-scraping implementation from git history
// (the commit immediately preceding this change) and address the
// datacenter-IP block + markup drift first.
export async function scoutBiggerPockets(): Promise<ScoutResult[]> {
  return [];
}
