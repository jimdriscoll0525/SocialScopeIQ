import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { objectiveLabel } from "@/lib/chatgpt-ads/objectives";
import { CAMPAIGN_STATUS_LABEL, formatMoney } from "@/lib/chatgpt-ads/format";
import { pct, summarizeMetrics } from "@/lib/chatgpt-ads/metrics";
import type { AdCampaign, AdCampaignMetric, AdCampaignStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_BADGE: Record<AdCampaignStatus, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  submitted_to_chatgpt: "bg-blue-50 text-blue-800",
  active: "bg-green-50 text-green-800",
  paused: "bg-amber-50 text-amber-800",
  ended: "bg-neutral-200 text-neutral-600"
};

export default async function AdsPage() {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) return null;

  const { data: campaignRows, error } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const campaigns = (campaignRows || []) as AdCampaign[];

  const metricsByCampaign: Record<string, AdCampaignMetric[]> = {};
  if (campaigns.length > 0) {
    const { data: metricRows } = await supabase
      .from("ad_campaign_metrics")
      .select("*")
      .in(
        "campaign_id",
        campaigns.map((c) => c.id)
      );
    for (const m of (metricRows || []) as AdCampaignMetric[]) {
      (metricsByCampaign[m.campaign_id] ||= []).push(m);
    }
  }

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ChatGPT Ads</h1>
          <p className="text-sm text-neutral-500">
            Build paid campaigns for OpenAI&apos;s ChatGPT Ads with AI, paste them into the Ads Manager, and
            track results here.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/ads/resources" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
            Ad Resources
          </Link>
          <Link href="/ads/new" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">
            New Campaign
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load campaigns: {error.message}. Has migration 014_chatgpt_ads.sql been run?
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-sm text-neutral-600">No campaigns yet.</p>
          <p className="mt-1 text-xs text-neutral-500">
            Start with New Campaign: pick an objective and market, and the AI builds 4–6 ad groups with
            prompt-based targeting, compliant copy, and UTM-tagged links.
          </p>
          <Link
            href="/ads/new"
            className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            New Campaign
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="px-4 py-2 font-medium">Campaign</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Market</th>
                <th className="px-4 py-2 font-medium">Objective</th>
                <th className="px-4 py-2 text-right font-medium">Budget/day</th>
                <th className="px-4 py-2 text-right font-medium">Clicks</th>
                <th className="px-4 py-2 text-right font-medium">Leads</th>
                <th className="px-4 py-2 text-right font-medium">Spend</th>
                <th className="px-4 py-2 text-right font-medium">Lead/click</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const t = summarizeMetrics(metricsByCampaign[c.id] || []);
                return (
                  <tr key={c.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link href={`/ads/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status]}`}>
                        {CAMPAIGN_STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{c.target_market}</td>
                    <td className="px-4 py-3">{objectiveLabel(profile.role, c.objective)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(Number(c.daily_budget))}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.leads.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(t.spend)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{pct(t.leads_per_click)}</td>
                    <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                      <Link href={`/ads/${c.id}`} className="text-neutral-600 hover:text-black">
                        View
                      </Link>
                      <span className="mx-1 text-neutral-300">·</span>
                      <Link href={`/ads/${c.id}/edit`} className="text-neutral-600 hover:text-black">
                        Edit
                      </Link>
                      <span className="mx-1 text-neutral-300">·</span>
                      <Link href={`/ads/${c.id}#log-results`} className="text-neutral-600 hover:text-black">
                        Log Results
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
