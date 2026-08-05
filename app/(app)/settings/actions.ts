"use server";

import { getSessionUser } from "@/lib/supabase/server";

export type SettingsResult = { ok: true } | { ok: false; error: string };

export async function saveProductsCapabilities(text: string): Promise<SettingsResult> {
  const { supabase, user } = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const clean = text.trim().slice(0, 4000);
  const { error } = await supabase
    .from("profiles")
    .update({ products_capabilities: clean || null })
    .eq("id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// One URL per line. Anything that isn't a plausible http(s) URL is rejected
// with a message rather than silently dropped.
export async function saveSocialLinks(text: string): Promise<SettingsResult> {
  const { supabase, user } = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12);
  const bad = lines.find((l) => !/^https?:\/\/\S+\.\S+/.test(l));
  if (bad) return { ok: false, error: `Not a valid URL: "${bad}" — each line must start with https://` };

  const { error } = await supabase
    .from("profiles")
    .update({ social_links: lines })
    .eq("id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
