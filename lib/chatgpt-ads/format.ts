import type { AdBidType, AdCampaignStatus } from "@/lib/types";

// Plain-text formatting for the "Copy for ChatGPT Ads Manager" blocks. Pure
// (no DB, no React) so it's shared by the export view and any future sync.

export interface CampaignHeader {
  name: string;
  objective_label: string;
  target_market: string;
  daily_budget: number;
  bid_type: AdBidType;
  landing_page_url: string;
  notes?: string | null;
}

export interface AdGroupCopy {
  name: string;
  audience_theme: string;
  targeting_instructions: string;
  ad_headline: string;
  ad_body: string;
  ad_image_prompt: string;
  landing_page_url: string;
}

export const CAMPAIGN_STATUS_LABEL: Record<AdCampaignStatus, string> = {
  draft: "Draft",
  submitted_to_chatgpt: "Submitted to ChatGPT",
  active: "Active",
  paused: "Paused",
  ended: "Ended"
};

export const BID_TYPE_LABEL: Record<AdBidType, string> = {
  cpc: "CPC (cost per click)",
  cpm: "CPM (cost per 1,000 impressions)"
};

export function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export function formatCampaignBlock(c: CampaignHeader): string {
  const lines = [
    `Campaign name: ${c.name}`,
    `Objective: ${c.objective_label}`,
    `Target market: ${c.target_market}`,
    `Daily budget: ${formatMoney(c.daily_budget)}`,
    `Bid type: ${BID_TYPE_LABEL[c.bid_type]}`,
    `Default landing page: ${c.landing_page_url}`
  ];
  if (c.notes?.trim()) lines.push(`Notes: ${c.notes.trim()}`);
  return lines.join("\n");
}

export function formatAdGroupBlock(g: AdGroupCopy, index?: number): string {
  const title = index != null ? `Ad group ${index + 1}: ${g.name}` : `Ad group: ${g.name}`;
  return [
    title,
    `Audience theme: ${g.audience_theme}`,
    "",
    "Targeting instructions:",
    g.targeting_instructions.trim(),
    "",
    `Headline: ${g.ad_headline.trim()}`,
    `Body: ${g.ad_body.trim()}`,
    `Final URL: ${g.landing_page_url.trim()}`,
    "",
    "Image prompt:",
    g.ad_image_prompt.trim()
  ].join("\n");
}

export function formatFullBrief(c: CampaignHeader, groups: AdGroupCopy[]): string {
  const divider = "-".repeat(60);
  const parts = [
    "CHATGPT ADS CAMPAIGN BRIEF",
    divider,
    formatCampaignBlock(c),
    divider,
    ...groups.map((g, i) => `${formatAdGroupBlock(g, i)}\n${divider}`)
  ];
  return parts.join("\n");
}
