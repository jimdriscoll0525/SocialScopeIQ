import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile, getPublishedPosts } from "@/lib/public-blog";
import { ProfileView } from "@/components/PublicViews";

export const revalidate = 300; // public page, cache 5 min

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug, "loan_officer");
  if (!profile) return {};
  const name = `${profile.first_name} ${profile.last_name}`;
  return {
    title: `${name} — Mortgage Loan Officer${profile.company ? ` · ${profile.company}` : ""}`,
    description: profile.niche || `Mortgage guidance from ${name}.`,
    alternates: {
      canonical: `/lo/${profile.slug}`,
      types: { "application/rss+xml": `/lo/${profile.slug}/rss.xml` }
    }
  };
}

export default async function LoProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug, "loan_officer");
  if (!profile) notFound();
  const posts = await getPublishedPosts(profile.id);
  return <ProfileView profile={profile} posts={posts} />;
}
