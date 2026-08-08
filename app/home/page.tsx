import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { supabaseAnon } from "@/lib/supabase";
import { getPublishedPosts, type PublicProfile } from "@/lib/public-blog";
import LeadCaptureForm from "@/components/LeadCaptureForm";
// Photos (free license, local copies — see lib/blog-images.ts for sources):
// hero: Pexels #1396122 by Binyamin Mellish; guide thumb: Pexels #106399.
import heroImg from "@/public/assets/blog/new-construction-home.jpg";
import guideImg from "@/public/assets/2-1-buydown-hero.jpg";

// The public front door. Anonymous visitors to "/" are rewritten here by the
// middleware (signed-in users still get the lead dashboard at "/"), so the
// canonical URL for this content is the site root.

export const revalidate = 300;

const DESCRIPTION =
  "Jim Driscoll is a mortgage loan officer with Mortgage Equity Partners and 31 years in the business, helping buyers in Massachusetts and New Hampshire finance homes with straight answers, not sales pitches.";

export const metadata: Metadata = {
  title: "Jim Driscoll — Mortgage Loan Officer | Mortgage Equity Partners",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Jim Driscoll — Mortgage Loan Officer",
    description: DESCRIPTION,
    type: "website",
    url: "/",
    images: [{ url: "/assets/blog/new-construction-home.jpg", width: 1400, height: 934, alt: "A newly built two-story home at sunset" }]
  }
};

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

async function getOwnerProfile(): Promise<PublicProfile | null> {
  const ownerId = process.env.OWNER_USER_ID;
  if (!ownerId) return null;
  const { data } = await supabaseAnon()
    .from("public_profiles")
    .select("*")
    .eq("id", ownerId)
    .maybeSingle();
  return (data as PublicProfile | null) ?? null;
}

export default async function HomePage() {
  const profile = await getOwnerProfile();
  const posts = profile ? (await getPublishedPosts(profile.id)).slice(0, 6) : [];
  const blogBase = profile ? `/lo/${profile.slug}` : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Jim Driscoll",
    jobTitle: "Mortgage Loan Officer",
    url: siteUrl(),
    telephone: "+16175299007",
    worksFor: { "@type": "Organization", name: "Mortgage Equity Partners" },
    ...(profile?.states_served?.length ? { areaServed: [...(profile.towns_served || []), ...profile.states_served] } : {}),
    ...(profile?.website || profile?.social_links?.length
      ? { sameAs: [profile.website, ...(profile.social_links || [])].filter(Boolean) }
      : {})
  };

  return (
    <div className="bg-white text-neutral-800">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-serif text-lg font-bold text-blue-950">Jim Driscoll</p>
            <p className="text-xs text-neutral-500">Mortgage Loan Officer · Mortgage Equity Partners · NMLS #21420</p>
          </div>
          <a
            href="#get-started"
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
          >
            Get Started
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="relative h-[360px] w-full sm:h-[440px]">
        <Image src={heroImg} alt="A newly built two-story home at sunset" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-950/85 via-blue-950/45 to-blue-950/20" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-6 pb-12">
            <h1 className="max-w-3xl font-serif text-3xl font-bold leading-tight text-white sm:text-5xl">
              Straight answers about home financing.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-blue-100">
              I&rsquo;m Jim Driscoll — 31 years as a mortgage loan officer, helping buyers in
              Massachusetts and New Hampshire structure the right loan, not the flashiest one.
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div id="get-started" className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <div>
            {/* Mobile-only lead form */}
            <div className="mb-10 lg:hidden">
              <LeadCaptureForm sourcePage="/" />
            </div>

            <h2 className="font-serif text-2xl font-bold tracking-tight text-blue-950">
              What I help with
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["First-time buyers", "Low down payment options, down payment assistance, and what approval actually takes."],
                ["Move-up buyers", "Sell-first vs. buy-first, bridge strategies, and making a financed offer competitive."],
                ["Self-employed borrowers", "How lenders read your tax returns — and the programs that work when they don't."],
                ["Investors", "2-4 families, DSCR loans, and financing that matches how you run your properties."]
              ].map(([title, body]) => (
                <li key={title} className="rounded-lg border border-neutral-200 p-4">
                  <p className="font-semibold text-blue-950">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{body}</p>
                </li>
              ))}
            </ul>

            {/* Featured guide */}
            <h2 className="mt-12 font-serif text-2xl font-bold tracking-tight text-blue-950">
              Featured guide
            </h2>
            <Link
              href="/blog/2-1-buydown"
              className="group mt-4 block overflow-hidden rounded-xl border border-neutral-200 transition-shadow hover:shadow-md sm:flex"
            >
              <div className="relative h-44 sm:h-auto sm:w-64 sm:shrink-0">
                <Image src={guideImg} alt="" fill className="object-cover" sizes="(min-width: 640px) 16rem, 100vw" />
              </div>
              <div className="p-5">
                <p className="font-serif text-lg font-bold text-blue-950 group-hover:underline">
                  What You Need to Know About How a 2-1 Buydown Works
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  Temporary rate buydowns explained by someone who&rsquo;s closed them for three
                  decades — how the escrow works, who they fit, and the real payment math on a
                  $500,000 loan.
                </p>
                <p className="mt-3 text-sm font-semibold text-blue-800">Read the guide →</p>
              </div>
            </Link>

            {/* Latest articles */}
            {posts.length > 0 && blogBase ? (
              <>
                <h2 className="mt-12 font-serif text-2xl font-bold tracking-tight text-blue-950">
                  Latest articles
                </h2>
                <ul className="mt-4 divide-y divide-neutral-200">
                  {posts.map((p) => (
                    <li key={p.id}>
                      <Link href={`${blogBase}/${p.slug}`} className="group block py-4">
                        <p className="font-medium text-neutral-900 underline-offset-2 group-hover:underline">
                          {p.title}
                        </p>
                        {p.meta_description ? (
                          <p className="mt-1 text-sm text-neutral-600">{p.meta_description}</p>
                        ) : null}
                        {p.published_at ? (
                          <p className="mt-1 text-xs text-neutral-400">{p.published_at.slice(0, 10)}</p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={blogBase} className="mt-2 inline-block text-sm font-semibold text-blue-800 hover:underline">
                  All articles →
                </Link>
              </>
            ) : null}
          </div>

          {/* Sidebar */}
          <aside className="lg:pt-2">
            <div className="space-y-6 lg:sticky lg:top-6">
              <div className="hidden lg:block">
                <LeadCaptureForm sourcePage="/" />
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6">
                <p className="font-serif text-lg font-bold text-blue-950">About Jim</p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  Thirty-one years in mortgage lending teaches you that every file is a person,
                  not a rate sheet. I&rsquo;ll walk you through your options in plain English,
                  show you the math, and tell you honestly which loan I&rsquo;d pick in your
                  shoes.
                </p>
                <p className="mt-3 text-xs text-neutral-500">
                  Mortgage Loan Officer · Mortgage Equity Partners · NMLS #21420
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-6 bg-blue-950 text-blue-100">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm">
          <p className="font-serif text-base font-bold text-white">Jim Driscoll · Mortgage Equity Partners</p>
          <p className="mt-2 text-blue-200">
            NMLS #21420 · Company NMLS #1936 · Equal Housing Opportunity ·{" "}
            <a href="tel:6175299007" className="underline underline-offset-2 hover:text-white">
              (617) 529-9007
            </a>
          </p>
          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-blue-300">
            This site is for educational purposes and does not constitute an offer of credit or a
            rate quote. All loans subject to credit approval.
          </p>
        </div>
      </footer>
    </div>
  );
}
