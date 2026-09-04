import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { objectiveLabel } from "@/lib/chatgpt-ads/objectives";
import CampaignExport from "@/components/ads/CampaignExport";
import MetricsLogger from "@/components/ads/MetricsLogger";
import type { AdCampaign, AdCampaignMetric, AdGroup } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const [{ data: groupRows }, { data: metricRows }] = await Promise.all([
    supabase.from("ad_groups").select("*").eq("campaign_id", id).order("position", { ascending: true }),
    supabase.from("ad_campaign_metrics").select("*").eq("campaign_id", id).order("date", { ascending: false })
  ]);

  const c = campaign as AdCampaign;

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <header className="mb-6 border-b border-neutral-200 pb-4">
        <Link href="/ads" className="text-xs text-neutral-500 hover:text-black">
          ← ChatGPT Ads
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{c.name}</h1>
      </header>
      <div className="space-y-6">
        <CampaignExport
          campaign={c}
          groups={(groupRows || []) as AdGroup[]}
          objectiveLabel={objectiveLabel(profile.role, c.objective)}
          role={profile.role}
        />
        <MetricsLogger campaignId={c.id} initialMetrics={(metricRows || []) as AdCampaignMetric[]} />
      </div>
    </main>
  );
}
