import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Magic-link landing. Handles both Supabase email-link shapes:
//   ?token_hash=...&type=email  (recommended custom email template)
//   ?code=...                   (default PKCE ConfirmationURL redirect)
// On success, routes to onboarding until the profile is complete.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  const supabase = await supabaseServer();

  let ok = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  if (!ok) {
    return NextResponse.redirect(new URL("/login?error=invalid-link", url.origin));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  let dest = "/onboarding";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.onboarding_complete) dest = "/";
  }
  return NextResponse.redirect(new URL(dest, url.origin));
}
