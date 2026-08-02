import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client (RLS applies). Most mutations go through
// server actions or /api routes; this exists for client components that need
// direct reads.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
