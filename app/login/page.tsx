"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "./actions";

// Email + password auth, same pattern as DealScopeIQ: Sign In / Create Account
// tabs, confirm-password on signup, email confirmation before first sign-in.
export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (tab === "signup") {
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
    }

    startTransition(async () => {
      if (tab === "signup") {
        const res = await signUp(email, password);
        if (!res.ok) setError(res.error);
        else if (res.needsConfirmation) {
          setSuccess("Check your email to confirm your account!");
        } else {
          router.push("/");
          router.refresh();
        }
      } else {
        const res = await signIn(email, password);
        if (!res.ok) setError(res.error);
        else {
          router.push("/");
          router.refresh();
        }
      }
    });
  }

  const inputClass =
    "rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-black";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">SocialScopeIQ</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Lead intelligence for loan officers and real estate agents.
      </p>

      <div className="mt-6 flex overflow-hidden rounded-md border border-neutral-300">
        {(["login", "signup"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide ${
              tab === t ? "bg-black text-white" : "bg-white text-neutral-500 hover:text-black"
            }`}
          >
            {t === "login" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>

      {success ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {success}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className={inputClass}
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={inputClass}
          />
          {tab === "signup" && (
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className={inputClass}
            />
          )}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-black px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? "…" : tab === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      )}
    </main>
  );
}
