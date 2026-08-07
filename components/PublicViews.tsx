import Link from "next/link";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { roleBasePath, type PublicProfile } from "@/lib/public-blog";
import type { BlogPost } from "@/lib/types";
import LeadCaptureForm from "@/components/LeadCaptureForm";
// Default post hero (free license, do not hotlink): Pexels #106399 by
// Binyamin Mellish — same photo as the 2-1 buydown landing page hero.
// https://www.pexels.com/photo/blue-and-gray-concrete-house-with-attic-during-twilight-106399/
import blogHeroImg from "@/public/assets/blog-hero-default.jpg";

// Server-rendered building blocks shared by the /lo/* and /agents/* public
// pages. The lead form is the only client JS beyond what Next ships anyway.

function fullName(p: PublicProfile): string {
  return `${p.first_name} ${p.last_name}`.trim();
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

// schema.org Person with sameAs — the machine-readable statement that the
// Reddit / BiggerPockets / LinkedIn accounts and this page are one person.
function personJsonLd(p: PublicProfile) {
  const canonical = `${siteUrl()}${roleBasePath(p.role)}/${p.slug}`;
  const org = p.role === "realtor" ? p.brokerage : p.company;
  const sameAs = [p.website, ...(p.social_links || [])].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: fullName(p),
    jobTitle: p.role === "realtor" ? "Real Estate Agent" : "Mortgage Loan Officer",
    url: canonical,
    ...(org ? { worksFor: { "@type": "Organization", name: org } } : {}),
    ...(p.states_served?.length ? { areaServed: [...(p.towns_served || []), ...p.states_served] } : {}),
    ...(sameAs.length ? { sameAs } : {})
  };
}

function JsonLd({ data }: { data: object }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

const HOST_LABELS: Record<string, string> = {
  "reddit.com": "Reddit",
  "biggerpockets.com": "BiggerPockets",
  "linkedin.com": "LinkedIn",
  "facebook.com": "Facebook",
  "instagram.com": "Instagram",
  "youtube.com": "YouTube",
  "x.com": "X",
  "twitter.com": "X"
};

function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return HOST_LABELS[host] || host;
  } catch {
    return url;
  }
}

function SocialLinks({ profile }: { profile: PublicProfile }) {
  const links = profile.social_links || [];
  if (links.length === 0) return null;
  return (
    <p className="mt-3 text-sm text-neutral-600">
      Find {profile.first_name} on:{" "}
      {links.map((url, i) => (
        <span key={url}>
          {i > 0 && " · "}
          <a href={url} target="_blank" rel="me noreferrer" className="underline underline-offset-2 hover:text-black">
            {linkLabel(url)}
          </a>
        </span>
      ))}
    </p>
  );
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
      <JsonLd data={personJsonLd(profile)} />
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
        <SocialLinks profile={profile} />
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
  const path = `${base}/${post.slug}`;
  const postLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    ...(post.meta_description ? { description: post.meta_description } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    dateModified: post.updated_at,
    image: `${siteUrl()}/assets/blog-hero-default.jpg`,
    mainEntityOfPage: `${siteUrl()}${path}`,
    author: personJsonLd(profile)
  };
  return (
    <main className="bg-white text-neutral-800">
      <JsonLd data={postLd} />

      {/* Hero — same design language as /blog/2-1-buydown */}
      <div className="relative h-[280px] w-full sm:h-[360px]">
        <Image src={blogHeroImg} alt="" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-950/85 via-blue-950/40 to-blue-950/20" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-6 pb-8">
            <Link href={base} className="text-sm text-blue-200 hover:text-white">
              ← {fullName(profile)}
            </Link>
            <h1 className="mt-2 max-w-3xl font-serif text-3xl font-bold leading-tight text-white sm:text-4xl">
              {post.title}
            </h1>
            <p className="mt-2 text-sm text-blue-100">
              By {fullName(profile)}
              {post.published_at ? ` · ${post.published_at.slice(0, 10)}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <article>
            {/* Mobile-only lead form so visitors see it without scrolling */}
            <div className="mb-8 lg:hidden">
              <LeadCaptureForm sourcePage={path} />
            </div>
            <div className="prose prose-neutral max-w-none prose-headings:font-serif prose-headings:text-blue-950 prose-a:text-blue-800">
              <ReactMarkdown>{post.content_md}</ReactMarkdown>
            </div>
          </article>

          <aside className="lg:pt-2">
            <div className="space-y-6 lg:sticky lg:top-6">
              <div className="hidden lg:block">
                <LeadCaptureForm sourcePage={path} />
              </div>
              <AuthorCard profile={profile} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
