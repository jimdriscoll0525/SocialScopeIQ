import { supabaseAnon } from "@/lib/supabase";
import type { BlogPost, Role } from "@/lib/types";

// Read-side helpers for the public pages (/lo/<slug>, /agents/<slug>).
// Everything goes through the anon client: public_profiles is the safe
// projection (no email/phone), and blog_posts RLS only exposes published rows.

export interface PublicProfile {
  id: string;
  slug: string;
  role: Role;
  first_name: string;
  last_name: string;
  company: string | null;
  brokerage: string | null;
  niche: string | null;
  states_served: string[];
  towns_served: string[];
  nmls: string | null;
  website: string | null;
  social_links: string[] | null;
}

export async function getPublicProfile(slug: string, role: Role): Promise<PublicProfile | null> {
  const { data } = await supabaseAnon()
    .from("public_profiles")
    .select("*")
    .eq("slug", slug)
    .eq("role", role)
    .maybeSingle();
  return (data as PublicProfile | null) ?? null;
}

export async function getPublishedPosts(authorId: string): Promise<BlogPost[]> {
  const { data } = await supabaseAnon()
    .from("blog_posts")
    .select("*")
    .eq("author_id", authorId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return (data || []) as BlogPost[];
}

export async function getPublishedPost(authorId: string, postSlug: string): Promise<BlogPost | null> {
  const { data } = await supabaseAnon()
    .from("blog_posts")
    .select("*")
    .eq("author_id", authorId)
    .eq("slug", postSlug)
    .eq("status", "published")
    .maybeSingle();
  return (data as BlogPost | null) ?? null;
}

export function roleBasePath(role: Role): string {
  return role === "realtor" ? "/agents" : "/lo";
}
