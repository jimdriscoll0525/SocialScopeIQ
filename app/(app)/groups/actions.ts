"use server";

import { getProfile } from "@/lib/supabase/server";
import { buildDrafterProfile } from "@/lib/drafter";
import { suggestGroups } from "@/lib/group-suggester";
import type { FbGroup, FbGroupStatus } from "@/lib/types";

export type GroupsResult = { ok: true; groups: FbGroup[] } | { ok: false; error: string };
export type GroupMutateResult = { ok: true } | { ok: false; error: string };

// Generate AI candidates and insert the new ones. Returns only the inserted rows.
export async function generateSuggestions(): Promise<GroupsResult> {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("fb_groups")
    .select("group_name")
    .eq("user_id", user.id);
  const existingNames = (existing || []).map((g) => g.group_name);

  try {
    const suggestions = await suggestGroups(buildDrafterProfile(profile), existingNames);
    if (suggestions.length === 0) return { ok: true, groups: [] };

    const { data, error } = await supabase
      .from("fb_groups")
      .insert(
        suggestions.map((s) => ({
          user_id: user.id,
          group_name: s.name,
          why: s.why || null,
          status: "candidate" as const,
          source: "suggested" as const
        }))
      )
      .select("*");
    if (error) return { ok: false, error: error.message };
    return { ok: true, groups: (data || []) as FbGroup[] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Suggestion failed." };
  }
}

export async function addGroup(name: string, url?: string): Promise<GroupsResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  const groupName = name.trim().slice(0, 200);
  if (!groupName) return { ok: false, error: "Group name is required." };

  const { data, error } = await supabase
    .from("fb_groups")
    .upsert(
      {
        user_id: user.id,
        group_name: groupName,
        group_url: url?.trim() || null,
        status: "joined",
        source: "manual"
      },
      { onConflict: "user_id,group_name" }
    )
    .select("*");
  if (error) return { ok: false, error: error.message };
  return { ok: true, groups: (data || []) as FbGroup[] };
}

export async function setGroupStatus(id: string, status: FbGroupStatus): Promise<GroupMutateResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase
    .from("fb_groups")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteGroup(id: string): Promise<GroupMutateResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("fb_groups").delete().eq("id", id).eq("user_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
