import type { MetadataRoute } from "next";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

// Public blog pages are crawlable; the authed app and APIs are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/lo/", "/agents/"], disallow: ["/api/", "/login", "/onboarding", "/bookmarklet", "/blog"] }],
    sitemap: `${siteUrl()}/sitemap.xml`
  };
}
