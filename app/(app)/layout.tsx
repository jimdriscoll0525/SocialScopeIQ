import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import Nav from "@/components/Nav";

// Authed shell: everything inside (app) requires a session (middleware
// enforces it too — this is belt and suspenders) and a completed profile.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getProfile();
  if (!user) redirect("/login");
  if (!profile?.onboarding_complete) redirect("/onboarding");

  return (
    <>
      <Nav
        role={profile.role}
        isAdmin={profile.is_admin}
        name={`${profile.first_name} ${profile.last_name}`}
      />
      {children}
    </>
  );
}
