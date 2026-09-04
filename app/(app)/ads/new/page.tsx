import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { objectivesForRole } from "@/lib/chatgpt-ads/objectives";
import CampaignBuilder from "@/components/ads/CampaignBuilder";
import type { AdResource } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120; // covers a campaign generation run

export default async function NewCampaignPage() {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) return null;

  const { data: resourceRows } = await supabase
    .from("ad_resources")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <header className="mb-6 border-b border-neutral-200 pb-4">
        <Link href="/ads" className="text-xs text-neutral-500 hover:text-black">
          ← ChatGPT Ads
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New Campaign</h1>
        <p className="text-sm text-neutral-500">
          Set the basics and the AI builds 4–6 ad groups, each aimed at a distinct reason someone would
          be asking ChatGPT about this. Review, edit, then save as a draft to get the copy blocks.
        </p>
      </header>
      <CampaignBuilder
        mode="create"
        role={profile.role}
        objectives={objectivesForRole(profile.role)}
        resources={(resourceRows || []) as AdResource[]}
        defaultLandingUrl={profile.website ?? ""}
        defaultMarket={profile.towns_served?.[0] ? `${profile.towns_served[0]} area` : ""}
      />
    </main>
  );
}
