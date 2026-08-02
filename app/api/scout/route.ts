import { NextResponse } from "next/server";
import { runScout } from "@/lib/run-scout";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — covers slow scraping + drafting

function requireCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed in production: a deploy missing CRON_SECRET must not expose
    // this endpoint. Local dev without the var stays convenient.
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

// Daily Vercel cron entrypoint. Behavior is unchanged from before the
// pipeline was extracted into lib/run-scout.ts: still auth-gated, still
// returns the same JSON summary. The dashboard button does NOT go through
// here — it calls runScout() directly via the triggerScout server action.
export async function GET(req: Request) {
  if (!requireCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runScout());
}
