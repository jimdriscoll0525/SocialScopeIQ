import type { AdBidType, AdCampaignStatus } from "@/lib/types";
import { adsManagerUrlParts } from "./utm";

// Plain-text formatting for the "Copy for ChatGPT Ads Manager" blocks. Pure
// (no DB, no React) so it's shared by the export view and any future sync.
//
// Field names and limits mirror the Ads Manager ad form exactly: Ad name,
// Ad destination URL, Landing page query parameters, Title (50), Description
// (100), square image. Targeting lives one level up on the ad group step.

export const TITLE_MAX = 50;
export const DESCRIPTION_MAX = 100;

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
  const url = adsManagerUrlParts(g.landing_page_url);
  const over = (len: number, max: number) => (len > max ? ` — OVER LIMIT by ${len - max}` : "");
  return [
    title,
    `Audience theme: ${g.audience_theme}`,
    "",
    "AD GROUP STEP — targeting instructions:",
    g.targeting_instructions.trim(),
    "",
    "AD STEP:",
    `Ad name: ${g.name}`,
    `Ad destination URL: ${url.destination_url}`,
    `Landing page query parameters: ${url.query_parameters}`,
    `Title (${g.ad_headline.trim().length}/${TITLE_MAX}${over(g.ad_headline.trim().length, TITLE_MAX)}): ${g.ad_headline.trim()}`,
    `Description (${g.ad_body.trim().length}/${DESCRIPTION_MAX}${over(g.ad_body.trim().length, DESCRIPTION_MAX)}): ${g.ad_body.trim()}`,
    "",
    "Image prompt (square, 1024x1024):",
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
