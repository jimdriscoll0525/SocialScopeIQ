"use server";

import { getSessionUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";
import { uniqueProfileSlug } from "@/lib/slug";
import type { Role } from "@/lib/types";

export interface OnboardingInput {
  role: Role;
  first_name: string;
  last_name: string;
  contact_email: string; // shown in signatures/public pages; defaults to login email
  phone: string;
  website: string;
  states_served: string[];
  towns_served: string[];
  niche: string;
  voice_sample: string;
  // loan officer
  company: string;
  nmls: string;
  license_states: string[];
  // realtor
  brokerage: string;
  license_numbers: string[];
}

export type OnboardingResult = { ok: true } | { ok: false; error: string };

export async function completeOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  const { supabase, user } = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const role: Role = input.role === "realtor" ? "realtor" : "loan_officer";
  const first = (input.first_name || "").trim();
  const last = (input.last_name || "").trim();
  if (!first || !last) return { ok: false, error: "First and last name are required." };

  const clean = (arr: string[]) =>
    Array.from(new Set((arr || []).map((s) => s.trim()).filter(Boolean)));

  const states = clean(input.states_served).map((s) => s.toUpperCase());
  const towns = clean(input.towns_served);
  if (role === "realtor" && towns.length === 0) {
    return { ok: false, error: "Add at least one town you serve — the Group Map is built from these." };
  }

  // Keep an existing slug on re-onboarding; otherwise generate one.
  // Slug uniqueness is checked with the service-role client because profiles
  // RLS is own-row only.
  const { data: existing } = await supabase
    .from("profiles")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  const slug = existing?.slug ?? (await uniqueProfileSlug(`${first} ${last}`, supabaseAdmin()));

  const row = {
    id: user.id,
    role,
    first_name: first,
    last_name: last,
    email: input.contact_email.trim().toLowerCase() || user.email || "",
    phone: input.phone.trim() || null,
    website: input.website.trim() || null,
    slug,
    states_served: states,
    towns_served: towns,
    niche: input.niche.trim() || null,
    voice_sample: input.voice_sample.trim() || null,
    company: role === "loan_officer" ? input.company.trim() || null : null,
    nmls: role === "loan_officer" ? input.nmls.trim() || null : null,
    license_states: role === "loan_officer" ? clean(input.license_states).map((s) => s.toUpperCase()) : null,
    brokerage: role === "realtor" ? input.brokerage.trim() || null : null,
    license_numbers: role === "realtor" ? clean(input.license_numbers) : null,
    onboarding_complete: true
  };

  const { error } = await supabase.from("profiles").upsert(row);
  if (error) return { ok: false, error: error.message };

  // Bookmarklet capture token (idempotent — keep any existing token).
  await supabase
    .from("bookmarklet_tokens")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

  return { ok: true };
}
