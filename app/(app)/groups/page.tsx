import { getProfile } from "@/lib/supabase/server";
import GroupMap from "@/components/GroupMap";
import type { FbGroup } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60; // covers a suggestion run

export default async function GroupsPage() {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) return null;

  const [{ data: groupRows, error }, { data: fbLeads }] = await Promise.all([
    supabase
      .from("fb_groups")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    // Per-group lead counts: captures store group_url (new) and put the group
    // name in source (always), so count on both keys.
    supabase
      .from("leads")
      .select("source, group_url")
      .eq("user_id", user.id)
      .eq("community", "Facebook")
  ]);

  const groups = (groupRows || []) as FbGroup[];
  const leadCounts: Record<string, number> = {};
  for (const l of fbLeads || []) {
    for (const key of [l.group_url, l.source]) {
      if (key) leadCounts[key] = (leadCounts[key] || 0) + 1;
    }
  }

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <header className="mb-6 border-b border-neutral-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Group Map</h1>
        <p className="text-sm text-neutral-500">
          Your Facebook group coverage: what you&apos;re in, what&apos;s worth joining, and which
          groups actually produce leads. Capturing a lead inside a group marks it joined
          automatically.
        </p>
      </header>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load groups: {error.message}. Has migration 006_group_map.sql been run?
        </div>
      ) : (
        <GroupMap initialGroups={groups} leadCounts={leadCounts} />
      )}
    </main>
  );
}
