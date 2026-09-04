"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteCampaign, setCampaignStatus } from "@/app/(app)/ads/actions";
import CopyButton from "./CopyButton";
import {
  BID_TYPE_LABEL,
  CAMPAIGN_STATUS_LABEL,
  formatAdGroupBlock,
  formatCampaignBlock,
  formatFullBrief,
  formatMoney
} from "@/lib/chatgpt-ads/format";
import type { AdCampaign, AdCampaignStatus, AdGroup, Role } from "@/lib/types";

// Campaign detail: status controls, "Open ChatGPT Ads Manager" checklist, and
// copy-buttoned blocks formatted for pasting into ads.openai.com.

const ADS_MANAGER_URL = "https://ads.openai.com";

const NEXT_STATUSES: Record<AdCampaignStatus, AdCampaignStatus[]> = {
  draft: ["submitted_to_chatgpt"],
  submitted_to_chatgpt: ["active", "draft"],
  active: ["paused", "ended"],
  paused: ["active", "ended"],
  ended: ["active"]
};

const STATUS_BUTTON_LABEL: Record<AdCampaignStatus, string> = {
  draft: "Back to draft",
  submitted_to_chatgpt: "Mark as submitted",
  active: "Mark active",
  paused: "Pause",
  ended: "End campaign"
};

const STATUS_BADGE: Record<AdCampaignStatus, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  submitted_to_chatgpt: "bg-blue-50 text-blue-800",
  active: "bg-green-50 text-green-800",
  paused: "bg-amber-50 text-amber-800",
  ended: "bg-neutral-200 text-neutral-600"
};

export default function CampaignExport({
  campaign,
  groups,
  objectiveLabel,
  role
}: {
  campaign: AdCampaign;
  groups: AdGroup[];
  objectiveLabel: string;
  role: Role;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, start] = useTransition();

  const header = {
    name: campaign.name,
    objective_label: objectiveLabel,
    target_market: campaign.target_market,
    daily_budget: Number(campaign.daily_budget),
    bid_type: campaign.bid_type,
    landing_page_url: campaign.landing_page_url,
    notes: campaign.notes
  };
  const campaignBlock = formatCampaignBlock(header);
  const fullBrief = formatFullBrief(header, groups);

  function changeStatus(status: AdCampaignStatus) {
    setNotice(null);
    start(async () => {
      const res = await setCampaignStatus(campaign.id, status);
      if (res.ok) {
        setNotice(`Status set to ${CAMPAIGN_STATUS_LABEL[status]}.`);
        router.refresh();
      } else setNotice(res.error);
    });
  }

  function remove() {
    start(async () => {
      const res = await deleteCampaign(campaign.id);
      if (res.ok) {
        router.push("/ads");
        router.refresh();
      } else setNotice(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header + status */}
      <section className="rounded-md border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[campaign.status]}`}>
                {CAMPAIGN_STATUS_LABEL[campaign.status]}
              </span>
              <span className="text-xs text-neutral-500">{objectiveLabel}</span>
            </div>
            <div className="mt-2 text-sm text-neutral-700">
              {campaign.target_market} · {formatMoney(Number(campaign.daily_budget))}/day · {BID_TYPE_LABEL[campaign.bid_type]}
            </div>
            <div className="mt-1 break-all text-xs text-neutral-500">
              Default landing page:{" "}
              <a href={campaign.landing_page_url} target="_blank" rel="noreferrer" className="underline">
                {campaign.landing_page_url}
              </a>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {NEXT_STATUSES[campaign.status].map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={busy}
                className={
                  s === "submitted_to_chatgpt"
                    ? "rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    : "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                }
              >
                {STATUS_BUTTON_LABEL[s]}
              </button>
            ))}
            <Link
              href={`/ads/${campaign.id}/edit`}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm"
            >
              Edit
            </Link>
            {confirmDelete ? (
              <>
                <button
                  onClick={remove}
                  disabled={busy}
                  className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-800 disabled:opacity-40"
                >
                  Confirm delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-2 py-1.5 text-xs text-neutral-500 hover:text-red-700"
              >
                Delete
              </button>
            )}
          </div>
        </div>
        {notice && (
          <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" role="status">
            {notice}
          </div>
        )}
      </section>

      {/* Ads Manager handoff */}
      <section className="rounded-md border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Submit in ChatGPT Ads Manager</h2>
            <p className="text-sm text-neutral-500">
              ChatGPT Ads has no API yet — campaigns are built here and pasted into OpenAI&apos;s self-serve
              Ads Manager.
            </p>
          </div>
          <a
            href={ADS_MANAGER_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Open ChatGPT Ads Manager ↗
          </a>
        </div>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
          <li>Create a new campaign and paste the campaign name.</li>
          <li>
            Set the daily budget ({formatMoney(Number(campaign.daily_budget))}) and bid type (
            {campaign.bid_type.toUpperCase()}); choose your pacing.
          </li>
          <li>Add one ad group per block below, pasting the targeting instructions for each.</li>
          <li>Paste the headline, body, and final URL into each ad. Generate the image from the prompt if you want a visual.</li>
          <li>Submit for review, then come back and click &quot;Mark as submitted&quot;.</li>
        </ol>
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {role === "realtor"
            ? "Real estate ads are reviewed for Fair Housing compliance. Keep copy about the property, the process, and the area's amenities — never who lives there."
            : "Financial services ads go through strict review on this platform. Copy is written conservatively (no rates, no guarantees, no \"pre-approved\") with NMLS and Equal Housing disclosures — keep those in if you edit. Field length limits in the Ads Manager may require trimming."}
        </p>
      </section>

      {/* Copy blocks */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Copy for ChatGPT Ads Manager</h2>
          <CopyButton text={fullBrief} label="Copy full campaign brief" primary />
        </div>

        <CopyBlock title="Campaign" text={campaignBlock} />

        {groups.map((g, i) => (
          <CopyBlock key={g.id} title={`Ad group ${i + 1}: ${g.name}`} text={formatAdGroupBlock(g, i)}>
            <div className="grid gap-2 text-xs md:grid-cols-2">
              <Field label="Targeting instructions" value={g.targeting_instructions} wide />
              <Field label="Headline" value={g.ad_headline} />
              <Field label="Body" value={g.ad_body} />
              <Field label="Final URL" value={g.landing_page_url} wide mono />
              <Field label="Image prompt" value={g.ad_image_prompt} wide />
            </div>
          </CopyBlock>
        ))}
      </section>
    </div>
  );
}

function CopyBlock({
  title,
  text,
  children
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-5" data-copy-block>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <CopyButton text={text} label="Copy block" />
      </div>
      {children ?? (
        <pre className="whitespace-pre-wrap break-words rounded-md bg-neutral-50 p-3 font-sans text-xs text-neutral-800">
          {text}
        </pre>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  wide = false,
  mono = false
}: {
  label: string;
  value: string;
  wide?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={`rounded-md bg-neutral-50 p-3 ${wide ? "md:col-span-2" : ""}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-neutral-600">{label}</span>
        <CopyButton text={value} label="Copy" className="!px-2 !py-0.5" />
      </div>
      <div className={`whitespace-pre-wrap break-words text-neutral-800 ${mono ? "font-mono" : ""}`}>
        {value || <span className="text-neutral-400">(empty)</span>}
      </div>
    </div>
  );
}
