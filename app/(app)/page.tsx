import { getProfile } from "@/lib/supabase/server";
import LeadsTable from "@/components/LeadsTable";
import RunScoutButton from "@/components/RunScoutButton";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300; // covers a manual "Find new posts" run

export default async function Page() {
  // RLS-scoped: the signed-in user's client. Loan officers see the shared LO
  // feed; realtors see unclaimed realtor leads plus their own claims.
  const { supabase, user, profile } = await getProfile();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("date_found", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  const leads = (data || []) as Lead[];
  const isRealtor = profile?.role === "realtor";

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <header className="mb-6 flex items-baseline justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lead feed</h1>
          <p className="text-sm text-neutral-500">{leads.length} leads</p>
        </div>
        {!isRealtor && <RunScoutButton />}
      </header>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load leads: {error.message}
        </div>
      ) : (
        <LeadsTable
          initialLeads={leads}
          variant={isRealtor ? "realtor" : "lo"}
          currentUserId={user?.id}
        />
      )}
    </main>
  );
}
