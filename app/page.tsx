import { supabaseAdmin } from "@/lib/supabase";
import LeadsTable from "@/components/LeadsTable";
import RunScoutButton from "@/components/RunScoutButton";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300; // covers a manual "Find new posts" run

export default async function Page() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("date_found", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  const leads = (data || []) as Lead[];

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <header className="mb-6 flex items-baseline justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SocialScopeIQ</h1>
          <p className="text-sm text-neutral-500">Lead dashboard · {leads.length} leads</p>
        </div>
        <nav className="flex gap-4 text-sm">
          <a href="/bookmarklet" className="text-neutral-600 hover:text-black">Bookmarklet</a>
          <RunScoutButton />
        </nav>
      </header>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load leads: {error.message}
        </div>
      ) : (
        <LeadsTable initialLeads={leads} />
      )}
    </main>
  );
}
