import { NextResponse } from "next/server";
import { chatgptAdsService, ChatGPTAdsNotAvailableError } from "@/lib/chatgpt-ads/service";

// Ingestion point for OpenAI's Conversions API / tracking pixel data.
// Excluded from the auth middleware (it's a server-to-server webhook), and
// gated by CHATGPT_ADS_WEBHOOK_SECRET once the service stub is implemented.
//
// TODO(chatgpt-ads-conversions): when the payload spec is known, implement
// chatgptAdsService.ingestConversionEvent, then upsert into
// ad_campaign_metrics (source = 'conversions_api') via supabaseAdmin here.
// Until then this answers 501 so nothing can silently write bad data.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CHATGPT_ADS_WEBHOOK_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }

  try {
    const event = await chatgptAdsService.ingestConversionEvent(payload, req.headers);
    return NextResponse.json({ ok: true, event });
  } catch (err) {
    if (err instanceof ChatGPTAdsNotAvailableError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 501 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}
