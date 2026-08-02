import type { SupabaseClient } from "@supabase/supabase-js";

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "user"
  );
}

// Find a free profile slug: base, base-2, base-3, ...
// Pass the service-role client: profiles RLS is own-row only, so a user's
// cookie client can't see other users' slugs to detect collisions.
export async function uniqueProfileSlug(
  base: string,
  admin: SupabaseClient
): Promise<string> {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const { data } = await admin
      .from("profiles")
      .select("slug")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${crypto.randomUUID().slice(0, 8)}`;
}
