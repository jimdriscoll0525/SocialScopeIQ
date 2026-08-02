import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile, getPublishedPost } from "@/lib/public-blog";
import { PostView } from "@/components/PublicViews";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string; postSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const profile = await getPublicProfile(slug, "loan_officer");
  if (!profile) return {};
  const post = await getPublishedPost(profile.id, postSlug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.meta_description || undefined,
    authors: [{ name: `${profile.first_name} ${profile.last_name}` }]
  };
}

export default async function LoPostPage({ params }: Props) {
  const { slug, postSlug } = await params;
  const profile = await getPublicProfile(slug, "loan_officer");
  if (!profile) notFound();
  const post = await getPublishedPost(profile.id, postSlug);
  if (!post) notFound();
  return <PostView profile={profile} post={post} />;
}
