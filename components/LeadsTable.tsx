"use client";

import { useMemo, useState } from "react";
import type { Lead, ResponseStatus, FollowupStatus } from "@/lib/types";

const STATUS_OPTIONS: ResponseStatus[] = ["DRAFT", "POSTED", "REPLIED", "ENGAGED", "IGNORED"];
const FOLLOWUP_OPTIONS: FollowupStatus[] = ["NOT STARTED", "IN PROGRESS", "DONE"];

export default function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [tier, setTier] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [community, setCommunity] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const communities = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => l.community && s.add(l.community));
    return Array.from(s).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (tier !== "ALL" && l.intent_tier !== tier) return false;
      if (status !== "ALL" && l.response_status !== status) return false;
      if (community !== "ALL" && l.community !== community) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${l.post_title || ""} ${l.author || ""} ${l.key_question || ""} ${l.primary_intent || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, tier, status, community, query]);

  async function copyResponse(lead: Lead) {
    if (!lead.drafted_response) return;
    try {
      await navigator.clipboard.writeText(lead.drafted_response);
      flash(`Copied draft for ${lead.author || "lead"}`);
    } catch {
      flash("Copy failed — select & copy manually.");
    }
  }

  async function patch(id: string, fields: Partial<Lead>) {
    const optimistic = leads.map((l) => (l.id === id ? { ...l, ...fields } : l));
    setLeads(optimistic);
    const res = await fetch(`/api/leads?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields)
    });
    if (!res.ok) {
      flash("Save failed.");
      setLeads(leads);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this lead?")) return;
    setLeads(leads.filter((l) => l.id !== id));
    await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
  }

  return (
    <>
      <Toast />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Select label="Tier" value={tier} onChange={setTier} options={["ALL", "TIER 1", "TIER 2", "TIER 3"]} />
        <Select label="Status" value={status} onChange={setStatus} options={["ALL", ...STATUS_OPTIONS]} />
        <Select label="Community" value={community} onChange={setCommunity} options={["ALL", ...communities]} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, author, intent…"
          className="min-w-[260px] flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5"
        />
        <div className="ml-auto text-neutral-500">{filtered.length} of {leads.length}</div>
      </div>

      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Community</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Author</th>
              <th className="px-3 py-2">Intent</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Follow-up</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((l) => {
              const isOpen = expanded === l.id;
              return (
                <>
                  <tr key={l.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 align-top text-neutral-600">{l.date_found}</td>
                    <td className="px-3 py-2 align-top">
                      <TierBadge tier={l.intent_tier} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{l.community}</div>
                      <div className="text-xs text-neutral-500">{l.source}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <button
                        className="text-left font-medium text-neutral-900 hover:underline"
                        onClick={() => setExpanded(isOpen ? null : l.id)}
                      >
                        {l.post_title}
                      </button>
                      {l.post_url && (
                        <div className="text-xs">
                          <a className="text-blue-600 hover:underline" href={l.post_url} target="_blank" rel="noreferrer">
                            open post ↗
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-neutral-600">{l.author}</td>
                    <td className="px-3 py-2 align-top text-neutral-600">{l.primary_intent}</td>
                    <td className="px-3 py-2 align-top">
                      <select
                        value={l.response_status}
                        onChange={(e) => patch(l.id, { response_status: e.target.value as ResponseStatus })}
                        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <select
                        value={l.followup_status}
                        onChange={(e) => patch(l.id, { followup_status: e.target.value as FollowupStatus })}
                        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                      >
                        {FOLLOWUP_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex gap-1">
                        <button
                          onClick={() => copyResponse(l)}
                          className="rounded bg-black px-2 py-1 text-xs text-white hover:bg-neutral-800"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => remove(l.id)}
                          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-neutral-50">
                      <td colSpan={9} className="px-3 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Key question" value={l.key_question} />
                          <Field label="Reason selected" value={l.reason_selected} />
                          <FieldEditable
                            label="Drafted response"
                            value={l.drafted_response || ""}
                            onSave={(v) => patch(l.id, { drafted_response: v })}
                            rows={14}
                            withCopy
                          />
                          <div className="space-y-3">
                            <FieldEditable
                              label="Response link (where you posted)"
                              value={l.response_link || ""}
                              onSave={(v) => patch(l.id, { response_link: v })}
                              rows={1}
                            />
                            <FieldEditable
                              label="Notes"
                              value={l.notes || ""}
                              onSave={(v) => patch(l.id, { notes: v })}
                              rows={6}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-neutral-500">
                  No leads match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Select({
  label, value, onChange, options
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-neutral-500">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1.5"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-xs text-neutral-400">—</span>;
  const color =
    tier === "TIER 1" ? "bg-emerald-100 text-emerald-800"
    : tier === "TIER 2" ? "bg-sky-100 text-sky-800"
    : "bg-neutral-100 text-neutral-700";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{tier}</span>;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-2 text-sm">{value || "—"}</div>
    </div>
  );
}

function FieldEditable({
  label, value, onSave, rows = 4, withCopy = false
}: { label: string; value: string; onSave: (v: string) => void; rows?: number; withCopy?: boolean }) {
  const [v, setV] = useState(value);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</span>
        <div className="flex gap-2">
          {withCopy && (
            <button
              onClick={async () => { await navigator.clipboard.writeText(v); flash("Copied"); }}
              className="text-xs text-blue-600 hover:underline"
            >
              Copy
            </button>
          )}
          {v !== value && (
            <button onClick={() => onSave(v)} className="text-xs text-blue-600 hover:underline">Save</button>
          )}
        </div>
      </div>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        rows={rows}
        className="w-full rounded-md border border-neutral-200 bg-white p-2 text-sm font-mono"
      />
    </div>
  );
}

// Toast — tiny global flash message via window event.
function Toast() {
  const [msg, setMsg] = useState<string | null>(null);
  if (typeof window !== "undefined" && !(window as any).__ssiqFlash) {
    (window as any).__ssiqFlash = (m: string) => {
      const evt = new CustomEvent("ssiq-flash", { detail: m });
      window.dispatchEvent(evt);
    };
    window.addEventListener("ssiq-flash", (e: any) => {
      setMsg(e.detail);
      setTimeout(() => setMsg(null), 1500);
    });
  }
  if (!msg) return null;
  return (
    <div className="fixed bottom-4 right-4 rounded-md bg-black px-3 py-2 text-sm text-white shadow-lg">
      {msg}
    </div>
  );
}

function flash(msg: string) {
  if (typeof window !== "undefined" && (window as any).__ssiqFlash) {
    (window as any).__ssiqFlash(msg);
  }
}
