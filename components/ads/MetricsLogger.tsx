"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteMetric, logMetrics } from "@/app/(app)/ads/actions";
import { formatMoney } from "@/lib/chatgpt-ads/format";
import { pct, summarizeMetrics } from "@/lib/chatgpt-ads/metrics";
import type { AdCampaignMetric } from "@/lib/types";

// Manual results entry (one row per day) plus a performance summary.
// Re-entering a date overwrites that day's numbers.

const INPUT = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-black";
const LABEL = "mb-1 block text-xs font-medium text-neutral-600";

function today(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export default function MetricsLogger({
  campaignId,
  initialMetrics
}: {
  campaignId: string;
  initialMetrics: AdCampaignMetric[];
}) {
  const [rows, setRows] = useState(initialMetrics);
  const [date, setDate] = useState(today());
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const [leads, setLeads] = useState("");
  const [spend, setSpend] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const totals = useMemo(() => summarizeMetrics(rows), [rows]);
  const sorted = useMemo(() => [...rows].sort((a, b) => (a.date < b.date ? 1 : -1)), [rows]);

  function submit() {
    setNotice(null);
    start(async () => {
      const res = await logMetrics(campaignId, {
        date,
        impressions: Number(impressions || 0),
        clicks: Number(clicks || 0),
        leads: Number(leads || 0),
        spend: Number(spend || 0)
      });
      if (!res.ok) {
        setNotice(res.error);
        return;
      }
      setRows((cur) => [...cur.filter((r) => r.id !== res.metric.id && r.date !== res.metric.date), res.metric]);
      setImpressions("");
      setClicks("");
      setLeads("");
      setSpend("");
      setNotice(`Logged ${res.metric.date}.`);
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteMetric(id);
      if (res.ok) setRows((cur) => cur.filter((r) => r.id !== id));
      else setNotice(res.error);
    });
  }

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-5" id="log-results">
      <h2 className="text-base font-semibold">Results</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Copy the daily numbers from the Ads Manager reporting view. Leads = form fills or calls you
        attribute to this campaign (check utm_campaign on your site&apos;s lead source).
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7" data-testid="metrics-summary">
        <Stat label="Impressions" value={totals.impressions.toLocaleString()} />
        <Stat label="Clicks" value={totals.clicks.toLocaleString()} />
        <Stat label="Leads" value={totals.leads.toLocaleString()} />
        <Stat label="Spend" value={formatMoney(totals.spend)} />
        <Stat label="CTR" value={pct(totals.ctr, 2)} />
        <Stat label="Lead / click" value={pct(totals.leads_per_click)} />
        <Stat label="Cost per lead" value={totals.cost_per_lead == null ? "—" : formatMoney(totals.cost_per_lead)} />
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        <div>
          <label className={LABEL}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} name="metric_date" />
        </div>
        <div>
          <label className={LABEL}>Impressions</label>
          <input type="number" min={0} value={impressions} onChange={(e) => setImpressions(e.target.value)} className={INPUT} name="impressions" />
        </div>
        <div>
          <label className={LABEL}>Clicks</label>
          <input type="number" min={0} value={clicks} onChange={(e) => setClicks(e.target.value)} className={INPUT} name="clicks" />
        </div>
        <div>
          <label className={LABEL}>Leads</label>
          <input type="number" min={0} value={leads} onChange={(e) => setLeads(e.target.value)} className={INPUT} name="leads" />
        </div>
        <div>
          <label className={LABEL}>Spend (USD)</label>
          <input type="number" min={0} step="0.01" value={spend} onChange={(e) => setSpend(e.target.value)} className={INPUT} name="spend" />
        </div>
        <div className="flex items-end">
          <button
            onClick={submit}
            disabled={busy}
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : "Log results"}
          </button>
        </div>
      </div>
      {notice && (
        <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" role="status">
          {notice}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Impr.</th>
                <th className="py-2 pr-3 font-medium">Clicks</th>
                <th className="py-2 pr-3 font-medium">Leads</th>
                <th className="py-2 pr-3 font-medium">Spend</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-3">{r.date}</td>
                  <td className="py-2 pr-3">{Number(r.impressions).toLocaleString()}</td>
                  <td className="py-2 pr-3">{Number(r.clicks).toLocaleString()}</td>
                  <td className="py-2 pr-3">{Number(r.leads).toLocaleString()}</td>
                  <td className="py-2 pr-3">{formatMoney(Number(r.spend))}</td>
                  <td className="py-2 pr-3 text-xs text-neutral-500">{r.source}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => remove(r.id)} className="text-xs text-neutral-500 hover:text-red-700">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-neutral-50 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
