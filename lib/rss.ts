import { getPublicProfile, getPublishedPosts, roleBasePath } from "@/lib/public-blog";
import { heroForSlug } from "@/lib/blog-images";
import { resolveYoutubeThumbnail } from "@/lib/youtube-server";
import type { Role } from "@/lib/types";

// RSS 2.0 feed for a public profile's published posts, generated straight
// from Supabase — the feed can never drift from the site. Consumed by the
// MEP site's blog carousel (and any other reader).

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Plain-text excerpt from markdown for items without a meta_description.
function excerpt(md: string, max = 240): string {
  const text = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> label
    .replace(/[#*_>`~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).replace(/\s\S*$/, "")}…` : text;
}

export async function buildRssResponse(slug: string, role: Role): Promise<Response> {
  const profile = await getPublicProfile(slug, role);
  if (!profile) return new Response("Not found", { status: 404 });

  const posts = await getPublishedPosts(profile.id);
  const base = siteUrl();
  const pagePath = `${roleBasePath(role)}/${profile.slug}`;
  const pageUrl = `${base}${pagePath}`;
  const feedUrl = `${pageUrl}/rss.xml`;
  const author = `${profile.first_name} ${profile.last_name}`;

  const items = await Promise.all(
    posts.map(async (post) => {
      const link = `${pageUrl}/${post.slug}`;
      const image = post.video_id
        ? await resolveYoutubeThumbnail(post.video_id)
        : `${base}${heroForSlug(post.slug)}`;
      const description = post.meta_description || excerpt(post.content_md);
      const pubDate = new Date(post.published_at || post.created_at).toUTCString();
      return [
        "    <item>",
        `      <title>${esc(post.title)}</title>`,
        `      <link>${esc(link)}</link>`,
        `      <guid isPermaLink="true">${esc(link)}</guid>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <description>${esc(description)}</description>`,
        `      <enclosure url="${esc(image)}" length="0" type="image/jpeg" />`,
        "    </item>"
      ].join("\n");
    })
  );

  const lastBuild = posts.length
    ? new Date(posts[0].published_at || posts[0].created_at).toUTCString()
    : new Date().toUTCString();

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${esc(`${author} — Blog`)}</title>`,
    `    <link>${esc(pageUrl)}</link>`,
    `    <description>${esc(`Latest articles from ${author}`)}</description>`,
    "    <language>en-us</language>",
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
    `    <atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml" />`,
    items.join("\n"),
    "  </channel>",
    "</rss>",
    ""
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Let the MEP plugin and CDNs cache briefly; Vercel revalidates per the
      // route's `revalidate` export anyway.
      "Cache-Control": "public, max-age=300"
    }
  });
}
