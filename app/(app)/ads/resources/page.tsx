import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import AdResourcesManager from "@/components/ads/AdResourcesManager";
import type { AdResource } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdResourcesPage() {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) return null;

  const { data, error } = await supabase
    .from("ad_resources")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      <header className="mb-6 border-b border-neutral-200 pb-4">
        <Link href="/ads" className="text-xs text-neutral-500 hover:text-black">
          ← ChatGPT Ads
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Ad Resources</h1>
        <p className="text-sm text-neutral-500">
          Reference material the campaign builder can use for context: product sheets, program details,
          lists like &quot;37 reasons people refinance&quot;. Tick them when you build a campaign.
        </p>
      </header>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load resources: {error.message}. Has migration 014_chatgpt_ads.sql been run?
        </div>
      ) : (
        <AdResourcesManager initialResources={(data || []) as AdResource[]} />
      )}
    </main>
  );
}
