import fs from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import BookmarkletLink from "./BookmarkletLink";

export const dynamic = "force-dynamic";

export default async function BookmarkletPage() {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/login");

  // The user's capture token, baked into the packed bookmarklet so captures
  // land under their account. Created on demand for accounts that onboarded
  // before tokens existed.
  let { data: tokenRow } = await supabase
    .from("bookmarklet_tokens")
    .select("token")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tokenRow) {
    await supabase.from("bookmarklet_tokens").insert({ user_id: user.id });
    ({ data: tokenRow } = await supabase
      .from("bookmarklet_tokens")
      .select("token")
      .eq("user_id", user.id)
      .maybeSingle());
  }
  const token = tokenRow?.token as string | undefined;

  const file = await fs.readFile(path.join(process.cwd(), "public", "bookmarklet.js"), "utf-8");
  const packed =
    "javascript:" +
    encodeURIComponent(
      // Only /* */ comments are stripped — a line-comment regex would also eat
      // the "https://" API URL. bookmarklet.js must not use // comments.
      file
        .replace("__SSIQ_TOKEN__", token || "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\s+/g, " ")
        .trim()
    );
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <a href="/" className="text-sm text-neutral-500 hover:text-black">← Back to dashboard</a>
      <h1 className="mt-2 text-2xl font-semibold">SocialScopeIQ Bookmarklet</h1>
      <p className="mt-2 text-neutral-600">
        Drag the link below to your browser&apos;s bookmarks bar. When you spot a real lead on Facebook,
        NextDoor, Quora, LinkedIn, or anywhere else, click the bookmark to capture it.
      </p>
      {!token && (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t load your capture token — finish onboarding first, then reload this page.
        </p>
      )}
      <div className="mt-6 rounded-md border border-neutral-200 bg-white p-4">
        <BookmarkletLink packed={packed} />
        <p className="mt-3 text-xs text-neutral-500">
          (Drag this button to your bookmarks bar. Clicking here in the page won&apos;t do anything — it&apos;s a bookmarklet, not a link.)
          {" "}The bookmarklet is personal — it captures to <em>your</em> account. If you re-drag it after
          an update, delete the old one.
        </p>
      </div>
      <h2 className="mt-8 text-lg font-semibold">How to use</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-neutral-700">
        <li>Drag the button above onto your browser&apos;s bookmarks bar.</li>
        <li>Browse Facebook groups, NextDoor, Quora, LinkedIn — any site where you spot a real lead.</li>
        <li>Open the post (or highlight its text with your mouse), then click the bookmark. Highlighting first helps on sites like LinkedIn where automatic detection is unreliable.</li>
        <li>A small dialog will pop up to confirm capture details.</li>
        <li>Submit. The lead lands in your dashboard with an AI-drafted response ready to review.</li>
      </ol>
      <h2 className="mt-8 text-lg font-semibold">Manual capture</h2>
      <p className="mt-2 text-neutral-600">
        If the bookmarklet doesn&apos;t pull clean text from a site, you can also POST directly to{" "}
        <code className="rounded bg-neutral-100 px-1">/api/bookmarklet</code> with JSON
        {" "}<code>{`{ token, community, source, post_title, post_url, author, body }`}</code>
        {" "}(your token is embedded in the bookmarklet above).
      </p>
      <h2 className="mt-8 text-lg font-semibold">Source (for the curious)</h2>
      <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-neutral-200 bg-neutral-950 p-3 text-xs text-neutral-100">
{file}
      </pre>
    </main>
  );
}
