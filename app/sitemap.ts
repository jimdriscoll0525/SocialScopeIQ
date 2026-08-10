import type { MetadataRoute } from "next";
import { supabaseAnon } from "@/lib/supabase";
import { roleBasePath } from "@/lib/public-blog";
import { youtubeThumbnails } from "@/lib/youtube";
import type { Role } from "@/lib/types";

export const revalidate = 3600;

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

// Public profile pages + published posts. Uses the anon client, so RLS keeps
// drafts and non-onboarded users out automatically.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const supabase = supabaseAnon();

  const [{ data: profiles }, { data: posts }] = await Promise.all([
    supabase.from("public_profiles").select("id, slug, role"),
    supabase
      .from("blog_posts")
      .select("slug, author_id, updated_at, title, meta_description, video_id")
      .eq("status", "published")
  ]);

  const profileById = new Map(
    ((profiles || []) as Array<{ id: string; slug: string; role: Role }>).map((p) => [
      p.id,
      p
    ])
  );

  const entries: MetadataRoute.Sitemap = [
    // Static public pages. "/" serves the public homepage to anonymous
    // visitors (middleware rewrite to /home).
    { url: base, changeFrequency: "weekly" },
    { url: `${base}/blog/2-1-buydown`, changeFrequency: "monthly" }
  ];
  for (const p of profileById.values()) {
    entries.push({ url: `${base}${roleBasePath(p.role)}/${p.slug}`, changeFrequency: "weekly" });
  }
  for (const post of (posts || []) as Array<{
    slug: string;
    author_id: string;
    updated_at: string;
    title: string;
    meta_description: string | null;
    video_id: string | null;
  }>) {
    const author = profileById.get(post.author_id);
    if (!author) continue;
    entries.push({
      url: `${base}${roleBasePath(author.role)}/${author.slug}/${post.slug}`,
      lastModified: post.updated_at,
      changeFrequency: "monthly",
      // Video sitemap extension for video posts. hqdefault always exists, so
      // no maxres HEAD check here.
      ...(post.video_id
        ? {
            videos: [
              {
                title: post.title,
                thumbnail_loc: youtubeThumbnails(post.video_id).hq,
                description: post.meta_description || post.title
              }
            ]
          }
        : {})
    });
  }
  return entries;
}
