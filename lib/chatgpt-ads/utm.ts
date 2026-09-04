import { slugify } from "@/lib/slug";

// UTM tagging for ad group landing pages so leads arriving on the site are
// attributable per ad group. Pure — safe to import from client components.

export const UTM_SOURCE = "chatgpt_ads";
export const UTM_MEDIUM = "paid";

export function campaignSlug(campaignName: string): string {
  return slugify(campaignName);
}

export function adGroupSlug(adGroupName: string): string {
  return slugify(adGroupName);
}

// Returns `baseUrl` with utm_source / utm_medium / utm_campaign / utm_content
// set (replacing any existing utm_* params so re-tagging is idempotent).
// Invalid URLs are returned unchanged.
export function withUtm(baseUrl: string, campaignName: string, adGroupName: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return "";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }
  for (const key of Array.from(url.searchParams.keys())) {
    if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
  }
  url.searchParams.set("utm_source", UTM_SOURCE);
  url.searchParams.set("utm_medium", UTM_MEDIUM);
  url.searchParams.set("utm_campaign", campaignSlug(campaignName));
  url.searchParams.set("utm_content", adGroupSlug(adGroupName));
  return url.toString();
}

// Strip utm_* params (used when a user edits the base URL on an ad group so
// the stored value can be re-tagged from a clean base).
export function stripUtm(url: string): string {
  try {
    const u = new URL(url.trim());
    for (const key of Array.from(u.searchParams.keys())) {
      if (key.toLowerCase().startsWith("utm_")) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return url.trim();
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ─── Ads Manager form split ──────────────────────────────────────────────────
// The ChatGPT Ads Manager ad form takes an "Ad destination URL" plus a
// separate "Landing page query parameters" field, which it appends to the
// destination and which supports template values {campaign_id},
// {ad_group_id}, {ad_id}, {ad_account_id}, {oppref}. So the export shows the
// stored (UTM-tagged) URL split into those two pieces, with utm_term carrying
// the platform's own ad id for per-ad attribution.

export interface AdsManagerUrlParts {
  destination_url: string; // clean page URL, no utm_*
  query_parameters: string; // "utm_source=...&utm_term={ad_id}" — paste as-is
}

export function adsManagerUrlParts(taggedUrl: string): AdsManagerUrlParts {
  let u: URL;
  try {
    u = new URL(taggedUrl.trim());
  } catch {
    return { destination_url: taggedUrl.trim(), query_parameters: "" };
  }
  const utm = new URLSearchParams();
  for (const [k, v] of Array.from(u.searchParams.entries())) {
    if (k.toLowerCase().startsWith("utm_")) {
      utm.set(k, v);
      u.searchParams.delete(k);
    }
  }
  if (!utm.has("utm_term")) utm.set("utm_term", "{ad_id}");
  // URLSearchParams encodes braces; the Ads Manager needs them literal.
  const query = utm.toString().replace(/%7B/gi, "{").replace(/%7D/gi, "}");
  return { destination_url: u.toString(), query_parameters: query };
}
