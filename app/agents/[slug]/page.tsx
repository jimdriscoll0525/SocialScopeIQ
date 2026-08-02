import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile, getPublishedPosts } from "@/lib/public-blog";
import { ProfileView } from "@/components/PublicViews";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug, "realtor");
  if (!profile) return {};
  const name = `${profile.first_name} ${profile.last_name}`;
  return {
    title: `${name} — Real Estate Agent${profile.brokerage ? ` · ${profile.brokerage}` : ""}`,
    description: profile.niche || `Local real estate guidance from ${name}.`
  };
}

export default async function AgentProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug, "realtor");
  if (!profile) notFound();
  const posts = await getPublishedPosts(profile.id);
  return <ProfileView profile={profile} posts={posts} />;
}
