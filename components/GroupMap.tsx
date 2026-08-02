"use client";

import { useMemo, useState, useTransition } from "react";
import { addGroup, deleteGroup, generateSuggestions, setGroupStatus } from "@/app/(app)/groups/actions";
import type { FbGroup, FbGroupStatus } from "@/lib/types";

// Facebook group coverage tracker. Joined groups arrive automatically from
// bookmarklet captures; candidates come from AI suggestions or manual adds.

const TABS: Array<{ key: FbGroupStatus; label: string }> = [
  { key: "joined", label: "Joined" },
  { key: "candidate", label: "Candidates" },
  { key: "ignored", label: "Ignored" }
];

function fbSearchUrl(name: string): string {
  return `https://www.facebook.com/search/groups/?q=${encodeURIComponent(name)}`;
}

export default function GroupMap({
  initialGroups,
  leadCounts
}: {
  initialGroups: FbGroup[];
  leadCounts: Record<string, number>; // keyed by group_url and by group_name
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [tab, setTab] = useState<FbGroupStatus>("joined");
  const [newName, setNewName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [suggesting, startSuggest] = useTransition();
  const [mutating, startMutate] = useTransition();

  const counts = useMemo(() => {
    const byTab: Record<FbGroupStatus, number> = { joined: 0, candidate: 0, ignored: 0 };
    for (const g of groups) byTab[g.status]++;
    return byTab;
  }, [groups]);

  const visible = groups
    .filter((g) => g.status === tab)
    .sort((a, b) => leadsFor(b) - leadsFor(a) || a.group_name.localeCompare(b.group_name));

  function leadsFor(g: FbGroup): number {
    return (g.group_url ? leadCounts[g.group_url] : 0) || leadCounts[g.group_name] || 0;
  }

  function suggest() {
    setNotice(null);
    startSuggest(async () => {
      const res = await generateSuggestions();
      if (res.ok) {
        setGroups((cur) => [...cur, ...res.groups]);
        setTab("candidate");
        setNotice(
          res.groups.length > 0
            ? `${res.groups.length} candidate groups added. Each links to a Facebook search — join the real ones you find.`
            : "No new suggestions — everything the AI came up with is already tracked."
        );
      } else setNotice(res.error);
    });
  }

  function add() {
    const name = newName.trim();
    if (!name) return;
    setNotice(null);
    startMutate(async () => {
      const res = await addGroup(name);
      if (res.ok) {
        const returned = res.groups[0];
        setGroups((cur) => {
          const rest = cur.filter((g) => g.id !== returned?.id);
          return returned ? [...rest, returned] : cur;
        });
        setNewName("");
        setTab("joined");
        setNotice(`Added "${name}" as joined.`);
      } else setNotice(res.error);
    });
  }

  function move(g: FbGroup, status: FbGroupStatus) {
    startMutate(async () => {
      const res = await setGroupStatus(g.id, status);
      if (res.ok) {
        setGroups((cur) => cur.map((x) => (x.id === g.id ? { ...x, status } : x)));
      } else setNotice(res.error);
    });
  }

  function remove(g: FbGroup) {
    if (!confirm(`Remove "${g.group_name}" from your Group Map?`)) return;
    startMutate(async () => {
      const res = await deleteGroup(g.id);
      if (res.ok) setGroups((cur) => cur.filter((x) => x.id !== g.id));
      else setNotice(res.error);
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={suggest}
          disabled={suggesting}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {suggesting ? "Thinking…" : "Suggest groups for my towns"}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add a group I've joined…"
            className="min-w-[260px] rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
          <button
            onClick={add}
            disabled={mutating || !newName.trim()}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {notice && (
        <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm">
          {notice}
        </div>
      )}

      <div className="mb-4 flex gap-2 text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 ${
              tab === t.key ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-700"
            }`}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Why / notes</th>
              <th className="px-3 py-2">Leads</th>
              <th className="px-3 py-2">Last capture</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                  {tab === "joined"
                    ? "No joined groups yet. They appear automatically when you capture a lead inside a Facebook group, or add one manually above."
                    : tab === "candidate"
                      ? 'No candidates. Click "Suggest groups for my towns" to build a hit list.'
                      : "Nothing ignored."}
                </td>
              </tr>
            )}
            {visible.map((g) => (
              <tr key={g.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2">
                  <a
                    href={g.group_url || fbSearchUrl(g.group_name)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {g.group_name} ↗
                  </a>
                  {!g.group_url && (
                    <span className="ml-2 text-xs text-neutral-400">(search)</span>
                  )}
                </td>
                <td className="max-w-[380px] px-3 py-2 text-neutral-500">{g.why || ""}</td>
                <td className="px-3 py-2">{leadsFor(g) || ""}</td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-500">
                  {g.last_capture_at ? g.last_capture_at.slice(0, 10) : ""}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {g.status !== "joined" && (
                    <button
                      onClick={() => move(g, "joined")}
                      disabled={mutating}
                      className="mr-2 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs disabled:opacity-40"
                    >
                      I joined
                    </button>
                  )}
                  {g.status !== "ignored" && (
                    <button
                      onClick={() => move(g, "ignored")}
                      disabled={mutating}
                      className="mr-2 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-500 disabled:opacity-40"
                    >
                      Ignore
                    </button>
                  )}
                  <button
                    onClick={() => remove(g)}
                    disabled={mutating}
                    className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-700 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
