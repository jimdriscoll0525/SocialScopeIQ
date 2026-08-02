import { getProfile } from "@/lib/supabase/server";
import BlogManager from "@/components/BlogManager";
import type { BlogPost } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300; // long-form generation is slow

export default async function BlogPage() {
  const { supabase, user, profile } = await getProfile();
  // (app) layout already redirects when signed out / not onboarded.
  if (!user || !profile) return null;

  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  const posts = (data || []) as BlogPost[];
  const publicBase = `/${profile.role === "realtor" ? "agents" : "lo"}/${profile.slug}`;
  const customUsed = posts.filter((p) => p.is_custom).length;

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <header className="mb-6 flex items-baseline justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="text-sm text-neutral-500">
            AI-drafted posts in your voice. Review and publish to{" "}
            <a href={publicBase} target="_blank" rel="noreferrer" className="underline">
              your public page ↗
            </a>
          </p>
        </div>
      </header>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load posts: {error.message}. Has migration 005_blog.sql been run?
        </div>
      ) : (
        <BlogManager
          initialPosts={posts}
          publicBase={publicBase}
          customUsed={customUsed}
          customLimit={profile.custom_blog_limit}
        />
      )}
    </main>
  );
}
