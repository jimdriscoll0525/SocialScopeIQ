"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createCampaign,
  generateCampaign,
  updateCampaign,
  type AdGroupInput,
  type CampaignFormInput
} from "@/app/(app)/ads/actions";
import type { AdObjective } from "@/lib/chatgpt-ads/objectives";
import { withUtm } from "@/lib/chatgpt-ads/utm";
import type { AdCampaign, AdGroup, AdResource, Role } from "@/lib/types";

// AI campaign builder (create) and campaign editor (edit). Create mode: fill
// the form, generate a package, review/edit the ad group cards, save as
// draft. Edit mode: same screen preloaded from the saved campaign.

type Props = {
  role: Role;
  objectives: AdObjective[];
  resources: AdResource[];
  defaultLandingUrl: string;
  defaultMarket: string;
} & ({ mode: "create" } | { mode: "edit"; campaign: AdCampaign; groups: AdGroup[] });

const INPUT = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-black";
const LABEL = "mb-1 block text-xs font-medium text-neutral-600";
const HEADLINE_MAX = 50;
const BODY_MAX = 160;

function blankGroup(): AdGroupInput {
  return {
    name: "",
    audience_theme: "",
    targeting_instructions: "",
    ad_headline: "",
    ad_body: "",
    ad_image_prompt: "",
    landing_page_url: "",
    status: "draft"
  };
}

export default function CampaignBuilder(props: Props) {
  const { role, objectives, resources, defaultLandingUrl, defaultMarket } = props;
  const router = useRouter();
  const editing = props.mode === "edit";

  const [form, setForm] = useState<CampaignFormInput>(() =>
    props.mode === "edit"
      ? {
          name: props.campaign.name,
          objective: props.campaign.objective,
          target_market: props.campaign.target_market,
          daily_budget: Number(props.campaign.daily_budget),
          bid_type: props.campaign.bid_type,
          landing_page_url: props.campaign.landing_page_url,
          notes: props.campaign.notes ?? "",
          tone_notes: "",
          resource_ids: []
        }
      : {
          name: "",
          objective: objectives[0]?.key ?? "",
          target_market: defaultMarket,
          daily_budget: 25,
          bid_type: "cpc",
          landing_page_url: defaultLandingUrl,
          notes: "",
          tone_notes: "",
          resource_ids: []
        }
  );
  const [groups, setGroups] = useState<AdGroupInput[]>(() =>
    props.mode === "edit"
      ? props.groups.map((g) => ({
          id: g.id,
          name: g.name,
          audience_theme: g.audience_theme,
          targeting_instructions: g.targeting_instructions,
          ad_headline: g.ad_headline,
          ad_body: g.ad_body,
          ad_image_prompt: g.ad_image_prompt,
          ad_image_url: g.ad_image_url,
          landing_page_url: g.landing_page_url,
          status: g.status
        }))
      : []
  );
  const [phase, setPhase] = useState<"form" | "review">(editing ? "review" : "form");
  const [reviewNotes, setReviewNotes] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [generating, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();

  const budgetStr = useMemo(() => String(form.daily_budget), [form.daily_budget]);

  function set<K extends keyof CampaignFormInput>(key: K, value: CampaignFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleResource(id: string) {
    setForm((f) => ({
      ...f,
      resource_ids: f.resource_ids.includes(id)
        ? f.resource_ids.filter((x) => x !== id)
        : [...f.resource_ids, id]
    }));
  }

  function generate() {
    setNotice(null);
    setConfirmRegen(false);
    startGenerate(async () => {
      const res = await generateCampaign(form);
      if (!res.ok) {
        setNotice(res.error);
        return;
      }
      setGroups(
        res.package.ad_groups.map((g) => ({
          name: g.name,
          audience_theme: g.audience_theme,
          targeting_instructions: g.targeting_instructions,
          ad_headline: g.ad_headline,
          ad_body: g.ad_body,
          ad_image_prompt: g.ad_image_prompt,
          landing_page_url: g.landing_page_url,
          status: "draft"
        }))
      );
      setReviewNotes(res.package.review_notes);
      setPhase("review");
      setNotice(`${res.package.ad_groups.length} ad groups generated. Review and edit anything below, then save.`);
    });
  }

  function save() {
    setNotice(null);
    startSave(async () => {
      const res =
        props.mode === "edit"
          ? await updateCampaign(props.campaign.id, form, groups)
          : await createCampaign(form, groups);
      if (!res.ok) {
        setNotice(res.error);
        return;
      }
      router.push(`/ads/${res.id}`);
      router.refresh();
    });
  }

  function updateGroup(i: number, patch: Partial<AdGroupInput>) {
    setGroups((cur) => cur.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }

  function removeGroup(i: number) {
    setGroups((cur) => cur.filter((_, idx) => idx !== i));
  }

  const formFields = (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className={LABEL}>Campaign name</label>
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={role === "realtor" ? "Spring buyer leads — Lynnfield" : "Boston metro refinance"}
          className={INPUT}
          name="campaign_name"
        />
      </div>
      <div>
        <label className={LABEL}>Objective</label>
        <select
          value={form.objective}
          onChange={(e) => set("objective", e.target.value)}
          className={INPUT}
          name="objective"
        >
          {objectives.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>Target market</label>
        <input
          value={form.target_market}
          onChange={(e) => set("target_market", e.target.value)}
          placeholder="Boston metro"
          className={INPUT}
          name="target_market"
        />
      </div>
      <div>
        <label className={LABEL}>Daily budget (USD)</label>
        <input
          type="number"
          min={0}
          step="1"
          value={budgetStr}
          onChange={(e) => set("daily_budget", Number(e.target.value))}
          className={INPUT}
          name="daily_budget"
        />
      </div>
      <div>
        <label className={LABEL}>Bid type</label>
        <select
          value={form.bid_type}
          onChange={(e) => set("bid_type", e.target.value as "cpc" | "cpm")}
          className={INPUT}
          name="bid_type"
        >
          <option value="cpc">CPC — pay per click</option>
          <option value="cpm">CPM — pay per 1,000 impressions</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className={LABEL}>Landing page URL (campaign default)</label>
        <input
          value={form.landing_page_url}
          onChange={(e) => set("landing_page_url", e.target.value)}
          placeholder="https://"
          className={INPUT}
          name="landing_page_url"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Each ad group gets this URL tagged with utm_source=chatgpt_ads, utm_medium=paid,
          utm_campaign=&lt;campaign&gt;, utm_content=&lt;ad group&gt; so leads are attributable per ad group.
        </p>
      </div>
      <div className="md:col-span-2">
        <label className={LABEL}>Tone / style notes for the AI (optional)</label>
        <textarea
          value={form.tone_notes}
          onChange={(e) => set("tone_notes", e.target.value)}
          rows={2}
          placeholder="e.g. Plain and direct, no hype. Lead with the question people actually ask."
          className={INPUT}
          name="tone_notes"
        />
      </div>
      <div className="md:col-span-2">
        <label className={LABEL}>Internal notes (optional, not sent to the AI)</label>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          className={INPUT}
          name="notes"
        />
      </div>
      <div className="md:col-span-2">
        <label className={LABEL}>Include ad resources as context</label>
        {resources.length === 0 ? (
          <p className="text-xs text-neutral-500">
            No saved resources yet.{" "}
            <Link href="/ads/resources" className="underline">
              Add product sheets or reference lists
            </Link>{" "}
            and they&apos;ll show up here as checkboxes.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {resources.map((r) => {
              const on = form.resource_ids.includes(r.id);
              return (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                    on ? "border-black bg-neutral-100" : "border-neutral-300 bg-white"
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={() => toggleResource(r.id)} />
                  {r.title}
                </label>
              );
            })}
            <Link href="/ads/resources" className="self-center text-xs text-neutral-500 underline">
              Manage
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm" role="status">
          {notice}
        </div>
      )}

      {phase === "form" ? (
        <section className="rounded-md border border-neutral-200 bg-white p-5">
          {formFields}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={generate}
              disabled={generating}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {generating ? "Building campaign… (20–40s)" : "Generate campaign with AI"}
            </button>
            {groups.length > 0 && (
              <button
                onClick={() => setPhase("review")}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                Back to ad groups ({groups.length})
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          <details className="rounded-md border border-neutral-200 bg-white p-5" open={editing}>
            <summary className="cursor-pointer text-sm font-medium">
              Campaign settings — {form.name || "(unnamed)"} · {form.target_market} · ${form.daily_budget}/day{" "}
              {form.bid_type.toUpperCase()}
            </summary>
            <div className="mt-4">{formFields}</div>
            <div className="mt-4 flex items-center gap-3">
              {confirmRegen ? (
                <>
                  <span className="text-sm text-neutral-600">Replace all {groups.length} ad groups?</span>
                  <button
                    onClick={generate}
                    disabled={generating}
                    className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {generating ? "Building…" : "Yes, regenerate"}
                  </button>
                  <button
                    onClick={() => setConfirmRegen(false)}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmRegen(true)}
                  disabled={generating}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Regenerate ad groups with AI
                </button>
              )}
            </div>
          </details>

          {reviewNotes.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="mb-1 font-medium">Before you submit, double-check:</div>
              <ul className="list-disc space-y-0.5 pl-5">
                {reviewNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4" data-testid="ad-group-cards">
            {groups.map((g, i) => {
              const finalUrl = withUtm(g.landing_page_url || form.landing_page_url, form.name, g.name);
              return (
                <section key={g.id ?? `new-${i}`} className="rounded-md border border-neutral-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Ad group {i + 1}
                    </div>
                    <button
                      onClick={() => removeGroup(i)}
                      className="text-xs text-neutral-500 hover:text-red-700"
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className={LABEL}>Name</label>
                      <input
                        value={g.name}
                        onChange={(e) => updateGroup(i, { name: e.target.value })}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Audience theme</label>
                      <input
                        value={g.audience_theme}
                        onChange={(e) => updateGroup(i, { audience_theme: e.target.value })}
                        className={INPUT}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={LABEL}>
                        Targeting instructions — the prompts / questions this ad should appear against
                      </label>
                      <textarea
                        value={g.targeting_instructions}
                        onChange={(e) => updateGroup(i, { targeting_instructions: e.target.value })}
                        rows={6}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>
                        Headline{" "}
                        <span className={g.ad_headline.length > HEADLINE_MAX ? "text-red-600" : "text-neutral-400"}>
                          ({g.ad_headline.length}/{HEADLINE_MAX})
                        </span>
                      </label>
                      <input
                        value={g.ad_headline}
                        onChange={(e) => updateGroup(i, { ad_headline: e.target.value })}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>
                        Body{" "}
                        <span className="text-neutral-400">
                          ({g.ad_body.length} chars; aim under {BODY_MAX} before the disclosure tail)
                        </span>
                      </label>
                      <textarea
                        value={g.ad_body}
                        onChange={(e) => updateGroup(i, { ad_body: e.target.value })}
                        rows={3}
                        className={INPUT}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={LABEL}>Landing page (leave blank to use the campaign default)</label>
                      <input
                        value={g.landing_page_url}
                        onChange={(e) => updateGroup(i, { landing_page_url: e.target.value })}
                        placeholder={form.landing_page_url}
                        className={INPUT}
                      />
                      <p className="mt-1 break-all text-xs text-neutral-500">
                        Final URL: <span className="font-mono">{finalUrl || "—"}</span>
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <label className={LABEL}>Image prompt</label>
                      <textarea
                        value={g.ad_image_prompt}
                        onChange={(e) => updateGroup(i, { ad_image_prompt: e.target.value })}
                        rows={3}
                        className={INPUT}
                      />
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={saving || groups.length === 0}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Save as draft"}
            </button>
            <button
              onClick={() => setGroups((cur) => [...cur, blankGroup()])}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              type="button"
            >
              Add blank ad group
            </button>
            {!editing && (
              <button
                onClick={() => setPhase("form")}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                type="button"
              >
                Back to settings
              </button>
            )}
            {editing && (
              <Link href={`/ads/${props.campaign.id}`} className="text-sm text-neutral-600 underline">
                Cancel
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
