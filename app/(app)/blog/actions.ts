"use server";

import { getProfile } from "@/lib/supabase/server";
import { buildDrafterProfile } from "@/lib/drafter";
import { generateBlogPost } from "@/lib/blogger";
import type { BlogPost } from "@/lib/types";

// Cap on unreviewed drafts per user. Generation (manual or cron) stops at the
// cap so the review queue can't silently pile up API spend. (Not exported:
// "use server" files may only export async functions.)
const MAX_PENDING_DRAFTS = 10;

export type BlogActionResult =
  | { ok: true; post: BlogPost }
  | { ok: false; error: string };

export type BlogMutateResult = { ok: true } | { ok: false; error: string };

// Generate a post as the signed-in user. With a topic it's a "custom" post and
// counts against profiles.custom_blog_limit; without one the model picks a
// fresh topic (uncapped beyond the pending-drafts guard — it's a manual click).
export async function generatePost(topic?: string): Promise<BlogActionResult> {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) return { ok: false, error: "Not signed in." };

  const isCustom = Boolean(topic?.trim());

  const { count: pendingCount } = await supabase
    .from("blog_posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .eq("status", "draft");
  if ((pendingCount ?? 0) >= MAX_PENDING_DRAFTS) {
    return {
      ok: false,
      error: `You have ${pendingCount} unreviewed drafts. Publish or delete some before generating more.`
    };
  }

  if (isCustom) {
    const { count } = await supabase
      .from("blog_posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id)
      .eq("is_custom", true);
    if ((count ?? 0) >= profile.custom_blog_limit) {
      return {
        ok: false,
        error: `Custom post limit reached (${profile.custom_blog_limit} on the ${profile.plan} plan).`
      };
    }
  }

  const { data: existing } = await supabase
    .from("blog_posts")
    .select("title, slug")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const existingTitles = (existing || []).map((p) => p.title);
  const existingSlugs = new Set((existing || []).map((p) => p.slug));

  try {
    const gen = await generateBlogPost({
      profile: buildDrafterProfile(profile),
      topic: topic?.trim() || null,
      existingTitles
    });

    // Per-author slug collision: base, base-2, base-3, ...
    let slug = gen.slug;
    for (let i = 2; existingSlugs.has(slug) && i < 50; i++) slug = `${gen.slug}-${i}`;

    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        author_id: user.id,
        slug,
        title: gen.title,
        meta_description: gen.meta_description || null,
        topic: gen.topic,
        content_md: gen.content_md,
        is_custom: isCustom
      })
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, post: data as BlogPost };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Generation failed." };
  }
}

export async function updatePost(
  id: string,
  fields: { title: string; meta_description: string; content_md: string }
): Promise<BlogMutateResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!fields.title.trim() || !fields.content_md.trim()) {
    return { ok: false, error: "Title and body can't be empty." };
  }
  // Slug is intentionally left alone on edit: published URLs stay stable.
  const { error } = await supabase
    .from("blog_posts")
    .update({
      title: fields.title.trim(),
      meta_description: fields.meta_description.trim() || null,
      content_md: fields.content_md
    })
    .eq("id", id)
    .eq("author_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setPostStatus(
  id: string,
  status: "draft" | "published"
): Promise<BlogMutateResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };

  const patch: Record<string, unknown> = { status };
  if (status === "published") {
    // Keep the original publish date on re-publish after an unpublish+edit.
    const { data } = await supabase
      .from("blog_posts")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();
    if (!data?.published_at) patch.published_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("blog_posts")
    .update(patch)
    .eq("id", id)
    .eq("author_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deletePost(id: string): Promise<BlogMutateResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase
    .from("blog_posts")
    .delete()
    .eq("id", id)
    .eq("author_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
