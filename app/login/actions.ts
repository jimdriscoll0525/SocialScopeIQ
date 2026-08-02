"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type AuthResult =
  | { ok: true; needsConfirmation?: boolean }
  | { ok: false; error: string };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    h.get("origin") ||
    `https://${h.get("x-forwarded-host") || h.get("host")}`
  );
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const clean = (email || "").trim().toLowerCase();
  if (!clean || !password) return { ok: false, error: "Please fill in all fields." };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: clean, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const clean = (email || "").trim().toLowerCase();
  if (!clean || !password) return { ok: false, error: "Please fill in all fields." };
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: clean,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` }
  });
  if (error) return { ok: false, error: error.message };

  // With email confirmation enabled, no session is returned until the user
  // clicks the link in their inbox.
  return { ok: true, needsConfirmation: !data.session };
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
