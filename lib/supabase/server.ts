import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { reqEnv } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

// Cookie-based Supabase client for Server Components, Server Actions, and
// Route Handlers. Runs as the signed-in user, so RLS applies. The service-role
// client (lib/supabase.ts supabaseAdmin) stays reserved for the cron scout,
// the bookmarklet endpoint, the blog cron, and scripts.
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    reqEnv("NEXT_PUBLIC_SUPABASE_URL"),
    reqEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components can't set cookies; middleware refreshes the
            // session, so swallowing this is safe.
          }
        }
      }
    }
  );
}

export async function getSessionUser() {
  const supabase = await supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getProfile() {
  const { supabase, user } = await getSessionUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, profile: (data as Profile | null) ?? null };
}
