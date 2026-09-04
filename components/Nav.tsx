import Link from "next/link";
import { signOut } from "@/app/login/actions";
import type { Role } from "@/lib/types";

// Authed app shell nav.
export default function Nav({
  role,
  isAdmin,
  name
}: {
  role: Role;
  isAdmin: boolean;
  name: string;
}) {
  void role;
  void isAdmin;
  return (
    <div className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            SocialScopeIQ
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="text-neutral-600 hover:text-black">
              Feed
            </Link>
            <Link href="/bookmarklet" className="text-neutral-600 hover:text-black">
              Bookmarklet
            </Link>
            <Link href="/blog" className="text-neutral-600 hover:text-black">
              Blog
            </Link>
            <Link href="/groups" className="text-neutral-600 hover:text-black">
              Groups
            </Link>
            <Link href="/ads" className="text-neutral-600 hover:text-black">
              ChatGPT Ads
            </Link>
            <Link href="/settings" className="text-neutral-600 hover:text-black">
              Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-500">{name}</span>
          <form action={signOut}>
            <button type="submit" className="text-neutral-600 hover:text-black">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
