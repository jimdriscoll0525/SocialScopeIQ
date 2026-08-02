import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import OnboardingWizard from "./OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { user, profile } = await getProfile();
  if (!user) redirect("/login");
  if (profile?.onboarding_complete) redirect("/");

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to SocialScopeIQ</h1>
      <p className="mt-1 text-sm text-neutral-500">
        A couple of minutes of setup — this powers your feed and your AI drafts.
      </p>
      <OnboardingWizard email={user.email ?? ""} />
    </main>
  );
}
