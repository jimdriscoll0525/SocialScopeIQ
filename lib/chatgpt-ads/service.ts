import type { AdCampaign, AdGroup } from "@/lib/types";
import { generateCampaignPackage, type CampaignPackage, type GenerateCampaignInput } from "./generator";

// ─── ChatGPT Ads service layer ───────────────────────────────────────────────
// Single seam between SocialScopeIQ and OpenAI's ChatGPT Ads platform.
//
// TODAY: ChatGPT Ads is bought through the self-serve Ads Manager at
// https://ads.openai.com. There is NO public API for creating or managing
// campaigns, so the app generates the campaign package (generateCampaignPackage),
// the user pastes it into the Ads Manager, and results are logged by hand into
// ad_campaign_metrics. OpenAI does ship a Conversions API + tracking pixel for
// measurement; ingestion of that data is stubbed below.
//
// TOMORROW: when OpenAI releases a campaign API, implement the stubs here.
// The schema already carries ad_campaigns.external_campaign_id /
// external_status / synced_at, ad_groups.external_ad_group_id, and
// ad_campaign_metrics.source = 'conversions_api', so nothing outside this
// module (and the UI button that calls it) should need to change.

export class ChatGPTAdsNotAvailableError extends Error {
  constructor(what: string) {
    super(`ChatGPT Ads has no public API yet (${what}). Build the campaign here and paste it into https://ads.openai.com.`);
    this.name = "ChatGPTAdsNotAvailableError";
  }
}

export interface PushCampaignResult {
  external_campaign_id: string;
  external_status: string;
  ad_group_ids: Record<string, string>; // our ad_groups.id -> platform id
}

export interface ConversionEvent {
  // Shape is a placeholder pending OpenAI's Conversions API spec. Keep it
  // loose so the webhook route compiles today and gets tightened later.
  event_name: string;
  occurred_at: string;
  campaign_ref?: string | null; // utm_campaign slug or external_campaign_id
  ad_group_ref?: string | null; // utm_content slug or external_ad_group_id
  value?: number | null;
  raw: unknown;
}

export interface SyncedMetrics {
  date: string;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
}

export interface ChatGPTAdsService {
  // AI campaign package: 4-6 ad groups with prompt-based targeting, copy,
  // image prompts, and UTM'd landing URLs. Implemented.
  generateCampaignPackage(input: GenerateCampaignInput): Promise<CampaignPackage>;

  // TODO(chatgpt-ads-api): create/update the campaign + ad groups on the
  // platform and return platform ids. Persisting external_* columns is the
  // caller's job (server action), keeping this module free of Supabase.
  pushCampaignToChatGPT(campaign: AdCampaign, groups: AdGroup[]): Promise<PushCampaignResult>;

  // TODO(chatgpt-ads-api): pull daily performance for a campaign so
  // ad_campaign_metrics can be filled with source = 'conversions_api'.
  syncCampaignMetrics(campaign: AdCampaign, since: string): Promise<SyncedMetrics[]>;

  // TODO(chatgpt-ads-conversions): accept a Conversions API / pixel payload
  // (POST /api/chatgpt-ads/conversions), verify its signature, map it to a
  // campaign + ad group via UTM slugs or external ids, and return the
  // normalized event for the route to persist.
  ingestConversionEvent(payload: unknown, headers: Headers): Promise<ConversionEvent>;
}

export const chatgptAdsService: ChatGPTAdsService = {
  generateCampaignPackage,

  async pushCampaignToChatGPT() {
    throw new ChatGPTAdsNotAvailableError("pushCampaignToChatGPT");
  },

  async syncCampaignMetrics() {
    throw new ChatGPTAdsNotAvailableError("syncCampaignMetrics");
  },

  async ingestConversionEvent() {
    throw new ChatGPTAdsNotAvailableError("ingestConversionEvent");
  }
};

export type { CampaignPackage, GenerateCampaignInput, GeneratedAdGroup } from "./generator";
export const CHATGPT_ADS_MANAGER_URL = "https://ads.openai.com";
