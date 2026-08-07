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
    // /blog/2-1-buydown is a public landing page; the more-specific allow
    // wins over the /blog disallow (which covers the authed blog manager).
    rules: [{ userAgent: "*", allow: ["/lo/", "/agents/", "/blog/2-1-buydown"], disallow: ["/api/", "/login", "/onboarding", "/bookmarklet", "/blog"] }],
    sitemap: `${siteUrl()}/sitemap.xml`
  };
}
