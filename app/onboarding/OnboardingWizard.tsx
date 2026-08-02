"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "./actions";
import type { Role } from "@/lib/types";

// Small chips input: type a value, press Enter or comma to add it.
function ChipsInput({
  label,
  hint,
  values,
  onChange,
  placeholder
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim().replace(/,+$/, "");
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      onChange([...values, v]);
    }
    setDraft("");
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-neutral-500">{hint}</p>}
      <div className="flex flex-wrap gap-1.5 rounded-md border border-neutral-300 p-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-sm"
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-neutral-400 hover:text-black"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 border-none p-0.5 text-sm outline-none"
        />
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-neutral-500">{hint}</p>}
      <input
        {...props}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-black"
      />
    </div>
  );
}

export default function OnboardingWizard({ email }: { email: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<Role | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactEmail, setContactEmail] = useState(email);
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [company, setCompany] = useState("");
  const [nmls, setNmls] = useState("");
  const [licenseStates, setLicenseStates] = useState<string[]>([]);
  const [brokerage, setBrokerage] = useState("");
  const [licenseNumbers, setLicenseNumbers] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [towns, setTowns] = useState<string[]>([]);
  const [niche, setNiche] = useState("");
  const [voice, setVoice] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await completeOnboarding({
        role: role!,
        first_name: firstName,
        last_name: lastName,
        contact_email: contactEmail,
        phone,
        website,
        states_served: states,
        towns_served: towns,
        niche,
        voice_sample: voice,
        company,
        nmls,
        license_states: licenseStates,
        brokerage,
        license_numbers: licenseNumbers
      });
      if (res.ok) router.push("/");
      else setError(res.error);
    });
  }

  const steps = ["Your role", "About you", "Where you work"];

  return (
    <div className="mt-8">
      <ol className="mb-6 flex gap-2 text-xs text-neutral-500">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 ${
              i === step ? "bg-black text-white" : i < step ? "bg-neutral-200" : "bg-neutral-100"
            }`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: "loan_officer",
                title: "Loan officer",
                desc: "Mortgage leads from Reddit, BiggerPockets and more, with compliant AI reply drafts."
              },
              {
                value: "realtor",
                title: "Real estate agent",
                desc: "Buyer/seller/relocation leads in MA & NH, a Facebook Group Map for your farm towns, and AI drafts."
              }
            ] as { value: Role; title: string; desc: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setRole(opt.value);
                setStep(1);
              }}
              className={`rounded-lg border p-4 text-left hover:border-black ${
                role === opt.value ? "border-black" : "border-neutral-300"
              }`}
            >
              <div className="font-medium">{opt.title}</div>
              <div className="mt-1 text-sm text-neutral-500">{opt.desc}</div>
            </button>
          ))}
        </div>
      )}

      {step === 1 && role && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Field label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <Field
            label="Contact email"
            hint={`Shown in signatures and on your public page. Login email stays ${email}.`}
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <Field label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Field
            label="Website (optional)"
            hint="Included in your signature where the platform allows it."
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
          {role === "loan_officer" ? (
            <>
              <Field label="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
              <Field label="NMLS number" value={nmls} onChange={(e) => setNmls(e.target.value)} />
              <ChipsInput
                label="License states"
                values={licenseStates}
                onChange={setLicenseStates}
                placeholder="MA, NH, …"
              />
            </>
          ) : (
            <>
              <Field label="Brokerage" value={brokerage} onChange={(e) => setBrokerage(e.target.value)} />
              <ChipsInput
                label="License number(s)"
                values={licenseNumbers}
                onChange={setLicenseNumbers}
                placeholder="e.g. 9512345"
              />
            </>
          )}
          <div className="mt-2 flex justify-between">
            <button type="button" onClick={() => setStep(0)} className="text-sm text-neutral-500 hover:text-black">
              ← Back
            </button>
            <button
              type="button"
              disabled={!firstName.trim() || !lastName.trim()}
              onClick={() => setStep(2)}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && role && (
        <div className="flex flex-col gap-4">
          <ChipsInput
            label="States served"
            values={states}
            onChange={setStates}
            placeholder="MA, NH, …"
          />
          <ChipsInput
            label={role === "realtor" ? "Farm towns" : "Towns served"}
            hint={
              role === "realtor"
                ? "The towns you farm. Your Facebook Group Map is built from these."
                : "Towns or metro areas you focus on."
            }
            values={towns}
            onChange={setTowns}
            placeholder="Lynnfield, Wakefield, …"
          />
          <Field
            label="Niche / specialty"
            hint="Free text — e.g. first-time buyers, downsizing, investment properties."
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
          />
          <div>
            <label className="mb-1 block text-sm font-medium">Voice sample</label>
            <p className="mb-1.5 text-xs text-neutral-500">
              A short paragraph about yourself, written the way you actually write. The AI uses
              it to match your voice in drafts and blog posts.
            </p>
            <textarea
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="mt-2 flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="text-sm text-neutral-500 hover:text-black">
              ← Back
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Finish setup"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
