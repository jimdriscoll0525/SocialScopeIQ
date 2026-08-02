import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { roleBasePath, type PublicProfile } from "@/lib/public-blog";
import type { BlogPost } from "@/lib/types";

// Server-rendered building blocks shared by the /lo/* and /agents/* public
// pages. No auth, no client JS beyond what Next ships anyway.

function fullName(p: PublicProfile): string {
  return `${p.first_name} ${p.last_name}`.trim();
}

function territory(p: PublicProfile): string {
  if (p.towns_served?.length) {
    return `${p.towns_served.join(", ")}${p.states_served?.length ? ` (${p.states_served.join(", ")})` : ""}`;
  }
  return p.states_served?.join(", ") || "";
}

export function AuthorCard({ profile }: { profile: PublicProfile }) {
  const isRealtor = profile.role === "realtor";
  const org = isRealtor ? profile.brokerage : profile.company;
  const where = territory(profile);
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
      <p className="font-semibold">{fullName(profile)}</p>
      <p className="text-sm text-neutral-600">
        {isRealtor ? "Real Estate Agent" : "Mortgage Loan Officer"}
        {org ? ` · ${org}` : ""}
        {!isRealtor && profile.nmls ? ` · NMLS #${profile.nmls}` : ""}
      </p>
      {where && <p className="mt-1 text-sm text-neutral-600">Serving {where}</p>}
      {profile.website && (
        <a
          href={profile.website}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Get in touch
        </a>
      )}
    </div>
  );
}

export function ProfileView({ profile, posts }: { profile: PublicProfile; posts: BlogPost[] }) {
  const base = `${roleBasePath(profile.role)}/${profile.slug}`;
  return (
    <main className="mx-auto max-w-[720px] px-6 py-12">
      <header className="mb-10 border-b border-neutral-200 pb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{fullName(profile)}</h1>
        <p className="mt-2 text-neutral-600">
          {profile.role === "realtor" ? "Real Estate Agent" : "Mortgage Loan Officer"}
          {(profile.role === "realtor" ? profile.brokerage : profile.company)
            ? ` · ${profile.role === "realtor" ? profile.brokerage : profile.company}`
            : ""}
          {profile.role !== "realtor" && profile.nmls ? ` · NMLS #${profile.nmls}` : ""}
        </p>
        {territory(profile) && (
          <p className="mt-1 text-sm text-neutral-500">Serving {territory(profile)}</p>
        )}
        {profile.niche && <p className="mt-4 text-neutral-700">{profile.niche}</p>}
        {profile.website && (
          <a
            href={profile.website}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Get in touch
          </a>
        )}
      </header>

      <h2 className="mb-6 text-lg font-semibold">Articles</h2>
      {posts.length === 0 ? (
        <p className="text-neutral-500">No articles published yet — check back soon.</p>
      ) : (
        <ul className="space-y-6">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`${base}/${p.slug}`} className="group block">
                <p className="font-medium underline-offset-2 group-hover:underline">{p.title}</p>
                {p.meta_description && (
                  <p className="mt-1 text-sm text-neutral-600">{p.meta_description}</p>
                )}
                {p.published_at && (
                  <p className="mt-1 text-xs text-neutral-400">{p.published_at.slice(0, 10)}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export function PostView({ profile, post }: { profile: PublicProfile; post: BlogPost }) {
  const base = `${roleBasePath(profile.role)}/${profile.slug}`;
  return (
    <main className="mx-auto max-w-[720px] px-6 py-12">
      <Link href={base} className="text-sm text-neutral-500 hover:text-black">
        ← {fullName(profile)}
      </Link>
      <article className="mt-6">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">{post.title}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          By {fullName(profile)}
          {post.published_at ? ` · ${post.published_at.slice(0, 10)}` : ""}
        </p>
        <div className="prose prose-neutral mt-8 max-w-none">
          <ReactMarkdown>{post.content_md}</ReactMarkdown>
        </div>
      </article>
      <div className="mt-12">
        <AuthorCard profile={profile} />
      </div>
    </main>
  );
}
