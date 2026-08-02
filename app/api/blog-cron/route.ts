import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildDrafterProfile } from "@/lib/drafter";
import { generateBlogPost } from "@/lib/blogger";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Opus long-form generation is slow

// Cron stops generating for a user once this many drafts await review —
// unreviewed posts piling up means the user isn't publishing, and more
// generation is just API spend.
const MAX_PENDING_DRAFTS = 3;

function requireCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed in production (same pattern as /api/scout).
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

// Scheduled entrypoint: one auto-topic draft per onboarded user per run.
// Drafts land in the user's review queue; nothing is auto-published.
export async function GET(req: Request) {
  if (!requireCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data: profileRows, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("onboarding_complete", true);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary: Array<{ user: string; result: string }> = [];

  for (const row of (profileRows || []) as Profile[]) {
    const who = row.slug || row.id;
    try {
      const { count: pending } = await supabase
        .from("blog_posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", row.id)
        .eq("status", "draft");
      if ((pending ?? 0) >= MAX_PENDING_DRAFTS) {
        summary.push({ user: who, result: `skipped (${pending} drafts pending review)` });
        continue;
      }

      const { data: existing } = await supabase
        .from("blog_posts")
        .select("title, slug")
        .eq("author_id", row.id)
        .order("created_at", { ascending: false })
        .limit(50);
      const existingSlugs = new Set((existing || []).map((p) => p.slug));

      const gen = await generateBlogPost({
        profile: buildDrafterProfile(row),
        existingTitles: (existing || []).map((p) => p.title)
      });

      let slug = gen.slug;
      for (let i = 2; existingSlugs.has(slug) && i < 50; i++) slug = `${gen.slug}-${i}`;

      const { error: insertErr } = await supabase.from("blog_posts").insert({
        author_id: row.id,
        slug,
        title: gen.title,
        meta_description: gen.meta_description || null,
        topic: gen.topic,
        content_md: gen.content_md,
        is_custom: false
      });
      if (insertErr) throw new Error(insertErr.message);

      summary.push({ user: who, result: `drafted "${gen.title}"` });
    } catch (err) {
      // One user's failure never blocks the rest of the run.
      summary.push({
        user: who,
        result: `failed: ${err instanceof Error ? err.message : "unknown error"}`
      });
    }
  }

  return NextResponse.json({ generated: summary });
}
