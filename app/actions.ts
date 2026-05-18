"use server";

import { runScout } from "@/lib/run-scout";
import type { ScoutSummary } from "@/lib/run-scout";

// Manual-trigger guards. These live HERE (not in runScout) on purpose, so
// the daily cron — which calls runScout() directly — is never throttled
// or skipped by them. Note: serverless instances don't share memory, so
// this is best-effort per-instance (stops double-clicks / rapid re-runs),
// not a distributed lock.
let running = false;
let lastRunAt = 0;
const COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes between manual runs

export type TriggerResult =
  | { ok: true; summary: ScoutSummary }
  | { ok: false; reason: string };

export async function triggerScout(): Promise<TriggerResult> {
  if (running) {
    return { ok: false, reason: "A scout run is already in progress." };
  }
  const sinceLast = Date.now() - lastRunAt;
  if (lastRunAt && sinceLast < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - sinceLast) / 1000);
    return { ok: false, reason: `Just ran — try again in ${wait}s.` };
  }

  running = true;
  try {
    const summary = await runScout();
    lastRunAt = Date.now();
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Scout run failed." };
  } finally {
    running = false;
  }
}
