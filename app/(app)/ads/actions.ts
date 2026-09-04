"use server";

import { getProfile } from "@/lib/supabase/server";
import { buildDrafterProfile } from "@/lib/drafter";
import { chatgptAdsService, type CampaignPackage } from "@/lib/chatgpt-ads/service";
import { objectivesForRole } from "@/lib/chatgpt-ads/objectives";
import { isHttpUrl, withUtm } from "@/lib/chatgpt-ads/utm";
import type {
  AdBidType,
  AdCampaign,
  AdCampaignMetric,
  AdCampaignStatus,
  AdGroup,
  AdGroupStatus,
  AdResource
} from "@/lib/types";

// Server actions for the ChatGPT Ads tab. All reads/writes run as the
// signed-in user (RLS scopes everything per user). Generation goes through
// chatgptAdsService so a future platform API only touches that module.

export interface CampaignFormInput {
  name: string;
  objective: string;
  target_market: string;
  daily_budget: number;
  bid_type: AdBidType;
  landing_page_url: string;
  notes: string;
  tone_notes: string;
  resource_ids: string[];
}

export interface AdGroupInput {
  id?: string; // present when editing an existing row
  name: string;
  audience_theme: string;
  targeting_instructions: string;
  ad_headline: string;
  ad_body: string;
  ad_image_prompt: string;
  ad_image_url?: string | null;
  landing_page_url: string; // base or already-tagged; re-tagged on save
  status?: AdGroupStatus;
}

export interface MetricInput {
  date: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
}

export type GenerateResult = { ok: true; package: CampaignPackage } | { ok: false; error: string };
export type SaveCampaignResult = { ok: true; id: string } | { ok: false; error: string };
export type MutateResult = { ok: true } | { ok: false; error: string };
export type MetricResult = { ok: true; metric: AdCampaignMetric } | { ok: false; error: string };
export type ResourceResult = { ok: true; resource: AdResource } | { ok: false; error: string };

const CAMPAIGN_STATUSES: AdCampaignStatus[] = ["draft", "submitted_to_chatgpt", "active", "paused", "ended"];
const GROUP_STATUSES: AdGroupStatus[] = ["draft", "active", "paused", "ended"];

function validateForm(form: CampaignFormInput, role: "loan_officer" | "realtor"): string | null {
  if (!form.name?.trim()) return "Campaign name is required.";
  if (!objectivesForRole(role).some((o) => o.key === form.objective)) return "Pick an objective.";
  if (!form.target_market?.trim()) return "Target market is required.";
  if (!Number.isFinite(form.daily_budget) || form.daily_budget < 0) return "Daily budget must be a number.";
  if (form.bid_type !== "cpc" && form.bid_type !== "cpm") return "Bid type must be CPC or CPM.";
  if (!isHttpUrl(form.landing_page_url)) return "Landing page must be a full URL starting with https://";
  return null;
}

function cleanCampaign(form: CampaignFormInput) {
  return {
    name: form.name.trim().slice(0, 120),
    objective: form.objective,
    target_market: form.target_market.trim().slice(0, 120),
    daily_budget: Math.round(form.daily_budget * 100) / 100,
    bid_type: form.bid_type,
    landing_page_url: form.landing_page_url.trim(),
    notes: form.notes?.trim().slice(0, 2000) || null
  };
}

function cleanGroup(g: AdGroupInput, campaignName: string, campaignUrl: string, position: number) {
  const name = g.name.trim().slice(0, 80) || `Ad group ${position + 1}`;
  const base = g.landing_page_url?.trim() || campaignUrl;
  return {
    position,
    name,
    audience_theme: g.audience_theme?.trim().slice(0, 200) || "",
    targeting_instructions: g.targeting_instructions?.trim().slice(0, 3000) || "",
    ad_headline: g.ad_headline?.trim().slice(0, 120) || "",
    ad_body: g.ad_body?.trim().slice(0, 600) || "",
    ad_image_prompt: g.ad_image_prompt?.trim().slice(0, 1500) || "",
    ad_image_url: g.ad_image_url?.trim() || null,
    // Always re-tag: withUtm replaces any utm_* already on the URL, so the
    // slugs track the current campaign / group names.
    landing_page_url: withUtm(isHttpUrl(base) ? base : campaignUrl, campaignName, name),
    status: g.status && GROUP_STATUSES.includes(g.status) ? g.status : "draft"
  };
}

// ─── Generation ──────────────────────────────────────────────────────────────

export async function generateCampaign(form: CampaignFormInput): Promise<GenerateResult> {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) return { ok: false, error: "Not signed in." };

  const problem = validateForm(form, profile.role);
  if (problem) return { ok: false, error: problem };
  const objective = objectivesForRole(profile.role).find((o) => o.key === form.objective)!;

  let resources: Array<{ title: string; content: string }> = [];
  const ids = (form.resource_ids || []).filter(Boolean).slice(0, 10);
  if (ids.length > 0) {
    const { data } = await supabase
      .from("ad_resources")
      .select("id, title, content")
      .eq("user_id", user.id)
      .in("id", ids);
    resources = (data || []).map((r) => ({ title: r.title, content: r.content }));
  }

  try {
    const pkg = await chatgptAdsService.generateCampaignPackage({
      profile: buildDrafterProfile(profile),
      name: form.name.trim(),
      objective,
      target_market: form.target_market.trim(),
      daily_budget: form.daily_budget,
      bid_type: form.bid_type,
      landing_page_url: form.landing_page_url.trim(),
      tone_notes: form.tone_notes,
      resources
    });
    return { ok: true, package: pkg };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Generation failed." };
  }
}

// ─── Campaign CRUD ───────────────────────────────────────────────────────────

export async function createCampaign(form: CampaignFormInput, groups: AdGroupInput[]): Promise<SaveCampaignResult> {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) return { ok: false, error: "Not signed in." };
  const problem = validateForm(form, profile.role);
  if (problem) return { ok: false, error: problem };
  if (groups.length === 0) return { ok: false, error: "Add at least one ad group." };

  const campaign = cleanCampaign(form);
  const { data, error } = await supabase
    .from("ad_campaigns")
    .insert({ user_id: user.id, status: "draft", ...campaign })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Insert failed." };

  const rows = groups.map((g, i) => ({
    campaign_id: data.id,
    ...cleanGroup(g, campaign.name, campaign.landing_page_url, i)
  }));
  const { error: gErr } = await supabase.from("ad_groups").insert(rows);
  if (gErr) {
    await supabase.from("ad_campaigns").delete().eq("id", data.id);
    return { ok: false, error: gErr.message };
  }
  return { ok: true, id: data.id };
}

export async function updateCampaign(
  id: string,
  form: CampaignFormInput,
  groups: AdGroupInput[]
): Promise<SaveCampaignResult> {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) return { ok: false, error: "Not signed in." };
  const problem = validateForm(form, profile.role);
  if (problem) return { ok: false, error: problem };
  if (groups.length === 0) return { ok: false, error: "Keep at least one ad group." };

  const campaign = cleanCampaign(form);
  const { error } = await supabase
    .from("ad_campaigns")
    .update(campaign)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  const { data: existing } = await supabase.from("ad_groups").select("id").eq("campaign_id", id);
  const keep = new Set(groups.map((g) => g.id).filter(Boolean) as string[]);
  const toDelete = (existing || []).map((r) => r.id).filter((gid) => !keep.has(gid));
  if (toDelete.length > 0) {
    const { error: dErr } = await supabase.from("ad_groups").delete().in("id", toDelete);
    if (dErr) return { ok: false, error: dErr.message };
  }

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const row = cleanGroup(g, campaign.name, campaign.landing_page_url, i);
    const res = g.id
      ? await supabase.from("ad_groups").update(row).eq("id", g.id).eq("campaign_id", id)
      : await supabase.from("ad_groups").insert({ campaign_id: id, ...row });
    if (res.error) return { ok: false, error: res.error.message };
  }
  return { ok: true, id };
}

export async function setCampaignStatus(id: string, status: AdCampaignStatus): Promise<MutateResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!CAMPAIGN_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const { error } = await supabase
    .from("ad_campaigns")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteCampaign(id: string): Promise<MutateResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("ad_campaigns").delete().eq("id", id).eq("user_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// TODO(chatgpt-ads-api): wire a "Push to ChatGPT Ads" button to this once
// chatgptAdsService.pushCampaignToChatGPT is implemented. Today it returns
// the service's "no public API yet" message.
export async function pushCampaign(id: string): Promise<MutateResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  const [{ data: campaign }, { data: groups }] = await Promise.all([
    supabase.from("ad_campaigns").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("ad_groups").select("*").eq("campaign_id", id).order("position")
  ]);
  if (!campaign) return { ok: false, error: "Campaign not found." };
  try {
    const result = await chatgptAdsService.pushCampaignToChatGPT(
      campaign as AdCampaign,
      (groups || []) as AdGroup[]
    );
    await supabase
      .from("ad_campaigns")
      .update({
        external_campaign_id: result.external_campaign_id,
        external_status: result.external_status,
        synced_at: new Date().toISOString(),
        status: "submitted_to_chatgpt"
      })
      .eq("id", id)
      .eq("user_id", user.id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Push failed." };
  }
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

function num(v: unknown, integer: boolean): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return integer ? Math.round(n) : Math.round(n * 100) / 100;
}

export async function logMetrics(campaignId: string, input: MetricInput): Promise<MetricResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Pick a date." };
  const impressions = num(input.impressions, true);
  const clicks = num(input.clicks, true);
  const leads = num(input.leads, true);
  const spend = num(input.spend, false);
  if (impressions === null || clicks === null || leads === null || spend === null) {
    return { ok: false, error: "Impressions, clicks, leads, and spend must be non-negative numbers." };
  }

  // Ownership check (RLS also enforces it, but a clear error beats a silent no-op).
  const { data: owned } = await supabase
    .from("ad_campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!owned) return { ok: false, error: "Campaign not found." };

  const { data, error } = await supabase
    .from("ad_campaign_metrics")
    .upsert(
      { campaign_id: campaignId, date: input.date, impressions, clicks, leads, spend, source: "manual" },
      { onConflict: "campaign_id,date" }
    )
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Save failed." };
  return { ok: true, metric: data as AdCampaignMetric };
}

export async function deleteMetric(id: string): Promise<MutateResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("ad_campaign_metrics").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ─── Ad resources ────────────────────────────────────────────────────────────

export async function saveResource(
  input: { id?: string; title: string; content: string }
): Promise<ResourceResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  const title = input.title.trim().slice(0, 120);
  const content = input.content.trim().slice(0, 40000);
  if (!title) return { ok: false, error: "Title is required." };
  if (!content) return { ok: false, error: "Paste some content." };

  const query = input.id
    ? supabase.from("ad_resources").update({ title, content }).eq("id", input.id).eq("user_id", user.id)
    : supabase.from("ad_resources").insert({ user_id: user.id, title, content });
  const { data, error } = await query.select("*").single();
  if (error || !data) return { ok: false, error: error?.message || "Save failed." };
  return { ok: true, resource: data as AdResource };
}

export async function deleteResource(id: string): Promise<MutateResult> {
  const { supabase, user } = await getProfile();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("ad_resources").delete().eq("id", id).eq("user_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
