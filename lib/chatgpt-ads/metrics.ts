// Pure aggregation over ad_campaign_metrics rows. Shared by the campaigns
// list (topline per campaign) and the detail page's performance summary.

export interface MetricRow {
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
}

export interface MetricTotals extends MetricRow {
  days: number;
  ctr: number | null; // clicks / impressions
  leads_per_click: number | null; // leads / clicks
  cost_per_click: number | null;
  cost_per_lead: number | null;
}

export function summarizeMetrics(rows: MetricRow[]): MetricTotals {
  const t: MetricRow = { impressions: 0, clicks: 0, leads: 0, spend: 0 };
  for (const r of rows) {
    t.impressions += Number(r.impressions) || 0;
    t.clicks += Number(r.clicks) || 0;
    t.leads += Number(r.leads) || 0;
    t.spend += Number(r.spend) || 0;
  }
  return {
    ...t,
    days: rows.length,
    ctr: t.impressions > 0 ? t.clicks / t.impressions : null,
    leads_per_click: t.clicks > 0 ? t.leads / t.clicks : null,
    cost_per_click: t.clicks > 0 ? t.spend / t.clicks : null,
    cost_per_lead: t.leads > 0 ? t.spend / t.leads : null
  };
}

export function pct(v: number | null, digits = 1): string {
  return v == null ? "—" : `${(v * 100).toFixed(digits)}%`;
}
