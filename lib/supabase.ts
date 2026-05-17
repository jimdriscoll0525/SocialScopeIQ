import { createClient } from "@supabase/supabase-js";

function reqEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not set`);
  return v;
}

// Browser-safe (read-only against RLS-enabled tables).
// For v1 RLS is off, so this can read leads directly.
export function supabaseAnon() {
  const url = reqEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = reqEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

// Server-only. Used by cron, bookmarklet endpoint, backfill script.
export function supabaseAdmin() {
  const url = reqEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = reqEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
