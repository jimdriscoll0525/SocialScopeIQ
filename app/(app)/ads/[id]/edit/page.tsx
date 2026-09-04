import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { objectivesForRole } from "@/lib/chatgpt-ads/objectives";
import CampaignBuilder from "@/components/ads/CampaignBuilder";
import type { AdCampaign, AdGroup, AdResource } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120; // "Regenerate ad groups" runs generation from here

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) return null;

  const { data: campaign } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!campaign) notFound();

  const [{ data: groupRows }, { data: resourceRows }] = await Promise.all([
    supabase.from("ad_groups").select("*").eq("campaign_id", id).order("position", { ascending: true }),
    supabase.from("ad_resources").select("*").eq("user_id", user.id).order("created_at", { ascending: true })
  ]);

  const c = campaign as AdCampaign;

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <header className="mb-6 border-b border-neutral-200 pb-4">
        <Link href={`/ads/${c.id}`} className="text-xs text-neutral-500 hover:text-black">
          ← {c.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Edit Campaign</h1>
        <p className="text-sm text-neutral-500">
          Ad group URLs are re-tagged with UTM parameters from the current campaign and ad group names on save.
        </p>
      </header>
      <CampaignBuilder
        mode="edit"
        campaign={c}
        groups={(groupRows || []) as AdGroup[]}
        role={profile.role}
        objectives={objectivesForRole(profile.role)}
        resources={(resourceRows || []) as AdResource[]}
        defaultLandingUrl={profile.website ?? ""}
        defaultMarket=""
      />
    </main>
  );
}
