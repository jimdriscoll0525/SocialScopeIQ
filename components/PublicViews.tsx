import Link from "next/link";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPublishedPosts, roleBasePath, type PublicProfile } from "@/lib/public-blog";
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

// ---------------------------------------------------------------------------
// In-body bar chart. Generated posts can emit a fenced code block tagged
// `chart` whose body is JSON: {"title": "...", "unit": "$",
// "bars": [{"label": "...", "value": 123}, ...], "footnote": "..."}.
// Invalid JSON renders nothing rather than a broken block.

interface ChartSpec {
  title?: string;
  unit?: string;
  bars: Array<{ label: string; value: number }>;
  footnote?: string;
}

function parseChartSpec(raw: string): ChartSpec | null {
  try {
    const spec = JSON.parse(raw) as ChartSpec;
    if (!Array.isArray(spec.bars) || spec.bars.length < 2 || spec.bars.length > 6) return null;
    if (!spec.bars.every((b) => typeof b.label === "string" && Number.isFinite(b.value) && b.value >= 0)) {
      return null;
    }
    return spec;
  } catch {
    return null;
  }
}

function fmtValue(v: number, unit: string): string {
  const prefix = unit === "$" ? "$" : "";
  const suffix = unit && unit !== "$" ? unit : "";
  if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M${suffix}`;
  if (v >= 100_000) return `${prefix}${Math.round(v / 1000).toLocaleString("en-US")}k${suffix}`;
  return `${prefix}${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}${suffix}`;
}

function BlogChart({ spec }: { spec: ChartSpec }) {
  const W = 640;
  const H = 360;
  const M = { top: spec.title ? 56 : 32, right: 20, bottom: 48, left: 68 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const max = Math.max(...spec.bars.map((b) => b.value));
  // Round the axis top up to a clean step so gridlines land on round numbers.
  const rawStep = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= max) || rawStep;
  const yMax = step * 4;
  const y = (v: number) => Math.round((M.top + plotH - (v / yMax) * plotH) * 10) / 10;

  const n = spec.bars.length;
  const slot = plotW / n;
  const barW = Math.min(96, Math.round(slot * 0.62));
  const unit = spec.unit || "";

  const barPath = (x: number, top: number) => {
    const r = 4;
    const bottom = y(0);
    if (bottom - top < r * 2) return `M ${x} ${bottom} H ${x + barW} V ${top} H ${x} Z`;
    return `M ${x} ${bottom} V ${top + r} Q ${x} ${top} ${x + r} ${top} H ${x + barW - r} Q ${x + barW} ${top} ${x + barW} ${top + r} V ${bottom} Z`;
  };

  const desc = spec.bars.map((b) => `${b.label}: ${fmtValue(b.value, unit)}`).join(". ");

  return (
    <figure className="my-8 rounded-lg border border-neutral-200 p-4 sm:p-6">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${spec.title || "Bar chart"}. ${desc}`} className="w-full">
        {spec.title ? (
          <text x={M.left} y={24} fontSize={15} fontWeight={600} fill="#172554">
            {spec.title}
          </text>
        ) : null}
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={M.left} x2={W - M.right} y1={y(step * i)} y2={y(step * i)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={M.left - 8} y={y(step * i) + 4} textAnchor="end" fontSize={12} fill="#6b7280">
              {fmtValue(step * i, unit)}
            </text>
          </g>
        ))}
        {spec.bars.map((b, i) => {
          const x = M.left + slot * i + (slot - barW) / 2;
          const top = y(b.value);
          const tall = y(0) - top > 34;
          return (
            <g key={b.label}>
              <path d={barPath(x, top)} fill="#1e40af" />
              <text
                x={x + barW / 2}
                y={tall ? top + 20 : top - 8}
                textAnchor="middle"
                fontSize={13}
                fontWeight={600}
                fill={tall ? "#ffffff" : "#374151"}
              >
                {fmtValue(b.value, unit)}
              </text>
              <text x={x + barW / 2} y={y(0) + 20} textAnchor="middle" fontSize={12.5} fill="#374151">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      {spec.footnote ? (
        <figcaption className="mt-2 text-sm italic text-neutral-500">{spec.footnote}</figcaption>
      ) : null}
    </figure>
  );
}

// Custom markdown renderers: chart code blocks, constrained images, and
// horizontally-scrollable tables.
const markdownComponents = {
  pre: (props: React.HTMLAttributes<HTMLPreElement> & { children?: React.ReactNode }) => {
    const child = props.children as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;
    if (child?.props?.className?.includes("language-chart")) {
      const spec = parseChartSpec(String(child.props.children || ""));
      return spec ? <BlogChart spec={spec} /> : null;
    }
    return <pre {...props} />;
  },
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={props.alt || ""}
      loading="lazy"
      className="max-h-[420px] w-full rounded-lg object-cover"
    />
  ),
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  )
};

export async function PostView({ profile, post }: { profile: PublicProfile; post: BlogPost }) {
  const base = `${roleBasePath(profile.role)}/${profile.slug}`;
  const path = `${base}/${post.slug}`;
  // Internal links between posts help crawlers find the full set and keep
  // readers on the site. Newest three besides the one being read.
  const related = (await getPublishedPosts(profile.id)).filter((p) => p.slug !== post.slug).slice(0, 3);
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
            <div className="prose prose-neutral max-w-none prose-headings:font-serif prose-headings:text-blue-950 prose-a:text-blue-800 prose-th:text-blue-950">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {post.content_md}
              </ReactMarkdown>
            </div>

            {related.length > 0 ? (
              <section className="mt-12 border-t border-neutral-200 pt-8">
                <h2 className="font-serif text-xl font-bold text-blue-950">
                  More from {fullName(profile)}
                </h2>
                <ul className="mt-4 space-y-4">
                  {related.map((p) => (
                    <li key={p.id}>
                      <Link href={`${base}/${p.slug}`} className="group block">
                        <p className="font-medium text-neutral-900 underline-offset-2 group-hover:underline">
                          {p.title}
                        </p>
                        {p.meta_description ? (
                          <p className="mt-1 text-sm text-neutral-600">{p.meta_description}</p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
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
