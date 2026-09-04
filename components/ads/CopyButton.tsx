"use client";

import { useState } from "react";

// Clipboard button with an inline "Copied" flash (no dialogs).
export default function CopyButton({
  text,
  label = "Copy",
  primary = false,
  className = ""
}: {
  text: string;
  label?: string;
  primary?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1600);
  }

  const base = primary
    ? "rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
    : "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs";
  return (
    <button type="button" onClick={copy} className={`${base} ${className}`} data-copy-state={state}>
      {state === "done" ? "Copied ✓" : state === "failed" ? "Copy failed — select manually" : label}
    </button>
  );
}
