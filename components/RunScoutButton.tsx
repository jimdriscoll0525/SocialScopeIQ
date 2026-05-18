"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { triggerScout } from "@/app/actions";

export default function RunScoutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    if (pending) return;
    if (!confirm("Run a new lead search now? This calls the AI drafter and can take up to a minute.")) {
      return;
    }
    setMsg(null);
    start(async () => {
      try {
        const res = await triggerScout();
        if (!res.ok) {
          setMsg(res.reason);
          return;
        }
        const s = res.summary;
        setMsg(
          s.inserted > 0
            ? `Added ${s.inserted} lead${s.inserted === 1 ? "" : "s"} · ${s.matched} matched`
            : `No new leads · ${s.matched} matched, ${s.fresh} fresh`
        );
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Run failed.");
      }
    });
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={pending}
        className="rounded-md bg-black px-3 py-1 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? "Searching…" : "Find new posts"}
      </button>
      {msg && <span className="text-xs text-neutral-500">{msg}</span>}
    </span>
  );
}
