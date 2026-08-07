import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST /api/lead-capture — the "Get Started Today" form on public landing
// pages (/blog/2-1-buydown). Unauthenticated by design; the middleware matcher
// excludes this path. Two independent effects per lead:
//   1. Email alert to LEAD_ALERT_EMAIL via the Resend REST API.
//   2. Backup row in page_leads via the service-role client (RLS has no
//      public policies — see 011_page_leads.sql).
// Each is attempted even if the other fails; the request only errors when
// BOTH fail, so a lead is never silently lost while one channel works.

const MAX_PER_HOUR = 3;
const WINDOW_MS = 60 * 60 * 1000;

// Per-instance memory. Fluid Compute reuses instances across requests, so this
// blocks the common burst case; it is not a distributed limiter and resets on
// cold start, which is acceptable for a human-facing contact form.
const submissionsByIp = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (submissionsByIp.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_HOUR) {
    submissionsByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  submissionsByIp.set(ip, recent);
  // Don't let the map grow forever on a scan.
  if (submissionsByIp.size > 10000) submissionsByIp.clear();
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(body: Record<string, unknown>): { name: string; phone: string; email: string; sourcePage: string } | string {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const sourcePage = typeof body.sourcePage === "string" ? body.sourcePage.trim().slice(0, 200) : "";
  if (!name || name.length > 120) return "Please enter your name.";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return "Please enter a valid phone number.";
  if (!EMAIL_RE.test(email) || email.length > 200) return "Please enter a valid email address.";
  return { name, phone, email, sourcePage: sourcePage || "unknown" };
}

function easternTimestamp(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date());
}

async function sendAlertEmail(lead: { name: string; phone: string; email: string; sourcePage: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_ALERT_EMAIL || "jim@meploans.com";
  const from = process.env.RESEND_FROM_EMAIL || "SocialScopeIQ Leads <onboarding@resend.dev>";
  const subject = `\u{1F4DE} New Lead: ${lead.name} — call ${lead.phone}`;
  const html = `
    <h2>New lead from ${escapeHtml(lead.sourcePage)}</h2>
    <p><strong>Name:</strong> ${escapeHtml(lead.name)}</p>
    <p><strong>Phone:</strong> <a href="tel:${escapeHtml(lead.phone.replace(/[^\d+]/g, ""))}">${escapeHtml(lead.phone)}</a></p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></p>
    <p><strong>Page:</strong> ${escapeHtml(lead.sourcePage)}</p>
    <p><strong>Submitted:</strong> ${easternTimestamp()} (Eastern)</p>`;

  if (!apiKey) {
    // Local dev without a key: log instead of send so the flow is testable.
    console.log("[lead-capture] RESEND_API_KEY not set — would send:", { to, from, subject });
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  if (!res.ok) {
    console.error("[lead-capture] Resend error:", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

async function saveLead(lead: { name: string; phone: string; email: string; sourcePage: string }): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin()
      .from("page_leads")
      .insert({ name: lead.name, phone: lead.phone, email: lead.email, source_page: lead.sourcePage });
    if (error) {
      console.error("[lead-capture] insert failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    // Covers a missing SUPABASE_SERVICE_ROLE_KEY too — the email path still runs.
    console.error("[lead-capture] insert failed:", e);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real users never see or fill the "company" field. Pretend
  // success so bots don't learn they were caught.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a little while." },
      { status: 429 }
    );
  }

  const lead = validate(body);
  if (typeof lead === "string") {
    return NextResponse.json({ error: lead }, { status: 400 });
  }

  // Run both effects regardless of each other's outcome.
  const [emailOk, insertOk] = await Promise.all([
    sendAlertEmail(lead).catch((e) => {
      console.error("[lead-capture] email failed:", e);
      return false;
    }),
    saveLead(lead)
  ]);

  if (!emailOk && !insertOk) {
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
