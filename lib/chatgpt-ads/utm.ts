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
