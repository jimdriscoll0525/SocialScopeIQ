"use client";

import { useId, useState } from "react";

// "Get Started Today" card used on public landing pages (/blog/2-1-buydown).
// Rendered twice on that page (top-of-article on mobile + sticky sidebar), so
// every field id comes from useId to keep labels valid.

// Jim's direct line — shown on the card and as the error-state fallback.
const FALLBACK_PHONE: string = "(617) 529-9007";
const FALLBACK_EMAIL = "jim@financewithjim.com";

type Status = "idle" | "submitting" | "success" | "error";

const DEFAULT_SUBTEXT =
  "Have questions about your situation? Enter your info and I’ll personally give you a call.";

export default function LeadCaptureForm({
  sourcePage,
  subtext = DEFAULT_SUBTEXT
}: {
  sourcePage: string;
  subtext?: string;
}) {
  const uid = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const email = String(data.get("email") || "").trim();
    const company = String(data.get("company") || ""); // honeypot

    // Client-side checks mirror the server's; the server re-validates.
    if (!name || phone.replace(/\D/g, "").length < 10 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setServerMessage("Please double-check your name, phone, and email.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setServerMessage(null);
    try {
      const res = await fetch("/api/lead-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, company, sourcePage })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerMessage(typeof json.error === "string" ? json.error : null);
        setStatus("error");
        return;
      }
      setFirstName(name.split(/\s+/)[0]);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-blue-900/15 bg-blue-50 p-6 text-center" role="status">
        <p className="text-lg font-semibold text-blue-950">Thanks, {firstName}!</p>
        <p className="mt-2 text-sm text-blue-950/80">I&rsquo;ll be calling you shortly.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-900/15 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-xl font-bold text-blue-950">Get Started Today</h2>
      <p className="mt-1 text-sm text-neutral-600">{subtext}</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
        <div>
          <label htmlFor={`${uid}-name`} className="block text-sm font-medium text-neutral-800">
            Full name
          </label>
          <input
            id={`${uid}-name`}
            name="name"
            type="text"
            required
            autoComplete="name"
            maxLength={120}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
          />
        </div>
        <div>
          <label htmlFor={`${uid}-phone`} className="block text-sm font-medium text-neutral-800">
            Phone
          </label>
          <input
            id={`${uid}-phone`}
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            maxLength={25}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
          />
        </div>
        <div>
          <label htmlFor={`${uid}-email`} className="block text-sm font-medium text-neutral-800">
            Email
          </label>
          <input
            id={`${uid}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={200}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
          />
        </div>
        {/* Honeypot — hidden from real users, bots tend to fill it. */}
        <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor={`${uid}-company`}>Company</label>
          <input id={`${uid}-company`} name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full rounded-md bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
        >
          {status === "submitting" ? "Sending…" : "Request My Call"}
        </button>
        {status === "error" ? (
          <p className="text-sm text-red-700" role="alert">
            {serverMessage || "Sorry — that didn't go through. Please try again."}{" "}
            {"You can also reach me directly at "}
            {FALLBACK_PHONE ? (
              <>
                <a className="font-medium underline" href={`tel:${FALLBACK_PHONE.replace(/\D/g, "")}`}>
                  {FALLBACK_PHONE}
                </a>
                {" or "}
              </>
            ) : null}
            <a className="font-medium underline" href={`mailto:${FALLBACK_EMAIL}`}>
              {FALLBACK_EMAIL}
            </a>
            .
          </p>
        ) : null}
      </form>
      <p className="mt-3 border-t border-neutral-200 pt-3 text-sm text-neutral-600">
        Prefer to talk now? Call me directly at{" "}
        <a
          href={`tel:${FALLBACK_PHONE.replace(/\D/g, "")}`}
          className="font-semibold text-blue-900 underline underline-offset-2"
        >
          {FALLBACK_PHONE}
        </a>
        .
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        No spam, no obligation — just a conversation about your numbers.
      </p>
    </div>
  );
}
