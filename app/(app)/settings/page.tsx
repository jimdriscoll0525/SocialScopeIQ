import { getProfile } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  const { user, profile } = await getProfile();
  if (!user || !profile) return null;

  return (
    <main className="mx-auto max-w-[720px] px-6 py-8">
      <header className="mb-6 border-b border-neutral-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-500">
          Signed in as {profile.email} ({profile.role === "realtor" ? "Realtor" : "Loan Officer"})
        </p>
      </header>
      <SettingsForm
        initialProducts={profile.products_capabilities ?? ""}
        initialLinks={profile.social_links ?? []}
        role={profile.role}
      />
    </main>
  );
}
