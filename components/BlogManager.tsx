"use client";

import { Fragment, useState, useTransition } from "react";
import {
  deletePost,
  generatePost,
  generateVideoPost,
  setPostStatus,
  updatePost
} from "@/app/(app)/blog/actions";
import { parseYouTubeId } from "@/lib/youtube";
import type { BlogPost } from "@/lib/types";

// Blog review queue: generate → read/edit → publish. Posts never go public
// without the author clicking Publish here.
export default function BlogManager({
  initialPosts,
  publicBase,
  customUsed,
  customLimit
}: {
  initialPosts: BlogPost[];
  publicBase: string; // e.g. "/lo/james-driscoll"
  customUsed: number;
  customLimit: number;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [mode, setMode] = useState<"article" | "video">("article");
  const [topic, setTopic] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoDesc, setVideoDesc] = useState("");
  const [script, setScript] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    title: string;
    meta: string;
    body: string;
    transcript: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();

  const customRemaining = Math.max(0, customLimit - customUsed);

  function generate() {
    setNotice(null);
    if (mode === "video") {
      if (!parseYouTubeId(videoUrl)) {
        setNotice(
          "That doesn't look like a YouTube link. Paste a watch, youtu.be, Shorts, or embed URL — or just the 11-character video ID."
        );
        return;
      }
      startGenerate(async () => {
        const res = await generateVideoPost({ videoUrl, script, description: videoDesc });
        if (res.ok) {
          setPosts((cur) => [res.post, ...cur]);
          setVideoUrl("");
          setVideoDesc("");
          setScript("");
          setNotice(`Draft ready: "${res.post.title}" — read it over, then publish.`);
        } else {
          setNotice(res.error);
        }
      });
      return;
    }
    const t = topic.trim();
    startGenerate(async () => {
      const res = await generatePost(t || undefined);
      if (res.ok) {
        setPosts((cur) => [res.post, ...cur]);
        setTopic("");
        setNotice(`Draft ready: "${res.post.title}" — read it over, then publish.`);
      } else {
        setNotice(res.error);
      }
    });
  }

  function openPost(p: BlogPost) {
    if (expanded === p.id) {
      setExpanded(null);
      setEdit(null);
      return;
    }
    setExpanded(p.id);
    setEdit({
      title: p.title,
      meta: p.meta_description || "",
      body: p.content_md,
      transcript: p.transcript || ""
    });
  }

  function save(p: BlogPost) {
    if (!edit) return;
    const isVideo = Boolean(p.video_id);
    startSave(async () => {
      const res = await updatePost(p.id, {
        title: edit.title,
        meta_description: edit.meta,
        content_md: edit.body,
        ...(isVideo ? { transcript: edit.transcript } : {})
      });
      if (res.ok) {
        setPosts((cur) =>
          cur.map((x) =>
            x.id === p.id
              ? {
                  ...x,
                  title: edit.title,
                  meta_description: edit.meta || null,
                  content_md: edit.body,
                  ...(isVideo ? { transcript: edit.transcript || null } : {})
                }
              : x
          )
        );
        setNotice("Saved.");
      } else setNotice(res.error);
    });
  }

  function toggleStatus(p: BlogPost) {
    const next = p.status === "published" ? "draft" : "published";
    startSave(async () => {
      const res = await setPostStatus(p.id, next);
      if (res.ok) {
        setPosts((cur) =>
          cur.map((x) =>
            x.id === p.id
              ? { ...x, status: next, published_at: x.published_at || new Date().toISOString() }
              : x
          )
        );
        setNotice(next === "published" ? "Published — it's live on your public page." : "Unpublished.");
      } else setNotice(res.error);
    });
  }

  function remove(p: BlogPost) {
    if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    startSave(async () => {
      const res = await deletePost(p.id);
      if (res.ok) {
        setPosts((cur) => cur.filter((x) => x.id !== p.id));
        if (expanded === p.id) setExpanded(null);
        setNotice("Deleted.");
      } else setNotice(res.error);
    });
  }

  return (
    <>
      <div className="mb-6 rounded-md border border-neutral-200 bg-white p-4">
        <div className="mb-3 flex gap-1 rounded-md bg-neutral-100 p-1 text-sm" role="tablist">
          {(["article", "video"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setNotice(null);
              }}
              className={`rounded px-3 py-1.5 font-medium ${
                mode === m ? "bg-white shadow-sm" : "text-neutral-500 hover:text-black"
              }`}
              disabled={generating}
            >
              {m === "article" ? "Article" : "Video post"}
            </button>
          ))}
        </div>

        {mode === "article" ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Optional topic (leave blank to let AI pick one)…"
                className="min-w-[320px] flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                disabled={generating}
              />
              <button
                onClick={generate}
                disabled={generating || (topic.trim() !== "" && customRemaining === 0)}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {generating ? "Writing… (30-60s)" : "Generate draft"}
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Auto topics rotate through your niche and towns. Custom topics: {customRemaining} of {customLimit} left on your plan.
              Drafts are never published automatically.
            </p>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="YouTube video URL (watch, youtu.be, Shorts, or embed link)…"
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                disabled={generating}
              />
              <textarea
                value={videoDesc}
                onChange={(e) => setVideoDesc(e.target.value)}
                placeholder="Optional: describe the video (context for the AI — not published anywhere)…"
                rows={3}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                disabled={generating}
              />
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Paste the video script here…"
                rows={10}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                disabled={generating}
              />
              <button
                onClick={generate}
                disabled={generating || !videoUrl.trim() || !script.trim()}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {generating ? "Writing… (30-60s)" : "Generate video post"}
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              The AI writes an article that complements the video plus a cleaned-up transcript.
              Video posts don't count against your custom-topic limit. Drafts are never published automatically.
            </p>
          </>
        )}
      </div>

      {notice && (
        <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm">
          {notice}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Topic</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {posts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                  No posts yet. Generate your first draft above.
                </td>
              </tr>
            )}
            {posts.map((p) => {
              const isOpen = expanded === p.id;
              return (
                <Fragment key={p.id}>
                  <tr className="cursor-pointer hover:bg-neutral-50" onClick={() => openPost(p)}>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-500">
                      {p.created_at.slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 font-medium">{p.title}</td>
                    <td className="px-3 py-2 text-neutral-500">
                      {p.topic}
                      {p.is_custom && <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs">custom</span>}
                      {p.video_id && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">video</span>}
                    </td>
                    <td className="px-3 py-2">
                      {p.status === "published" ? (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Published
                        </span>
                      ) : (
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.status === "published" && (
                        <a
                          href={`${publicBase}/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-neutral-500 underline hover:text-black"
                        >
                          View ↗
                        </a>
                      )}
                    </td>
                  </tr>
                  {isOpen && edit && (
                    <tr>
                      <td colSpan={5} className="bg-neutral-50 px-4 py-4">
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-neutral-500">
                            Title
                            <input
                              value={edit.title}
                              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal text-black"
                            />
                          </label>
                          <label className="block text-xs font-medium text-neutral-500">
                            Meta description (search results snippet)
                            <input
                              value={edit.meta}
                              onChange={(e) => setEdit({ ...edit, meta: e.target.value })}
                              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal text-black"
                            />
                          </label>
                          <label className="block text-xs font-medium text-neutral-500">
                            Body (markdown)
                            <textarea
                              value={edit.body}
                              onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                              rows={18}
                              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs text-black"
                            />
                          </label>
                          {p.video_id && (
                            <>
                              <p className="text-xs text-neutral-500">
                                YouTube video: <span className="font-mono">{p.video_id}</span> (fixed — delete and
                                recreate the post to change the video)
                              </p>
                              <label className="block text-xs font-medium text-neutral-500">
                                Video transcript (plain text, shown under the article)
                                <textarea
                                  value={edit.transcript}
                                  onChange={(e) => setEdit({ ...edit, transcript: e.target.value })}
                                  rows={10}
                                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal text-black"
                                />
                              </label>
                            </>
                          )}
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => save(p)}
                              disabled={saving}
                              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                            >
                              Save changes
                            </button>
                            <button
                              onClick={() => toggleStatus(p)}
                              disabled={saving}
                              className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                            >
                              {p.status === "published" ? "Unpublish" : "Publish"}
                            </button>
                            <button
                              onClick={() => remove(p)}
                              disabled={saving}
                              className="ml-auto rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 disabled:opacity-40"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
