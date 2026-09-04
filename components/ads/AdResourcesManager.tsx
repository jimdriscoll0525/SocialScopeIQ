"use client";

import { useState, useTransition } from "react";
import { deleteResource, saveResource } from "@/app/(app)/ads/actions";
import type { AdResource } from "@/lib/types";

// Reference material (product sheets, "37 reasons people refinance", etc.)
// the campaign builder can include as generation context.

const INPUT = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-black";

export default function AdResourcesManager({ initialResources }: { initialResources: AdResource[] }) {
  const [resources, setResources] = useState(initialResources);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function reset() {
    setEditingId(null);
    setTitle("");
    setContent("");
  }

  function edit(r: AdResource) {
    setEditingId(r.id);
    setTitle(r.title);
    setContent(r.content);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function save() {
    setNotice(null);
    start(async () => {
      const res = await saveResource({ id: editingId ?? undefined, title, content });
      if (!res.ok) {
        setNotice(res.error);
        return;
      }
      setResources((cur) => {
        const rest = cur.filter((r) => r.id !== res.resource.id);
        return [...rest, res.resource].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
      setNotice(editingId ? "Updated." : `Added "${res.resource.title}".`);
      reset();
    });
  }

  function remove(id: string) {
    setConfirmId(null);
    start(async () => {
      const res = await deleteResource(id);
      if (res.ok) {
        setResources((cur) => cur.filter((r) => r.id !== id));
        if (editingId === id) reset();
      } else setNotice(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold">{editingId ? "Edit resource" : "Add a resource"}</h2>
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title — e.g. 37 reasons people refinance"
            className={INPUT}
            name="resource_title"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            placeholder="Paste the text. Product sheets, FAQ answers, reason lists, program eligibility notes — anything the AI should draw on when it writes campaigns."
            className={INPUT}
            name="resource_content"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={save}
            disabled={busy || !title.trim() || !content.trim()}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : editingId ? "Save changes" : "Add resource"}
          </button>
          {editingId && (
            <button onClick={reset} className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
              Cancel
            </button>
          )}
          {notice && <span className="text-sm text-neutral-600">{notice}</span>}
        </div>
      </section>

      {resources.length === 0 ? (
        <p className="text-sm text-neutral-500">No resources yet.</p>
      ) : (
        <ul className="space-y-3">
          {resources.map((r) => (
            <li key={r.id} className="rounded-md border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-neutral-500">{r.content}</div>
                  <div className="mt-1 text-xs text-neutral-400">{r.content.length.toLocaleString()} characters</div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <button onClick={() => edit(r)} className="rounded-md border border-neutral-300 bg-white px-2 py-1">
                    Edit
                  </button>
                  {confirmId === r.id ? (
                    <>
                      <button
                        onClick={() => remove(r.id)}
                        className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-red-800"
                      >
                        Confirm
                      </button>
                      <button onClick={() => setConfirmId(null)} className="px-2 py-1 text-neutral-500">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmId(r.id)} className="px-2 py-1 text-neutral-500 hover:text-red-700">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
