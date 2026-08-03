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
