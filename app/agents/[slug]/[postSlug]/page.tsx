import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile, getPublishedPost } from "@/lib/public-blog";
import { PostView } from "@/components/PublicViews";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string; postSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const profile = await getPublicProfile(slug, "realtor");
  if (!profile) return {};
  const post = await getPublishedPost(profile.id, postSlug);
  if (!post) return {};
  const path = `/agents/${profile.slug}/${post.slug}`;
  return {
    title: post.title,
    description: post.meta_description || undefined,
    authors: [{ name: `${profile.first_name} ${profile.last_name}` }],
    alternates: { canonical: path },
    openGraph: {
      title: post.title,
      description: post.meta_description || undefined,
      type: "article",
      url: path,
      images: [{ url: "/assets/blog-hero-default.jpg", width: 1600, height: 1067 }]
    }
  };
}

export default async function AgentPostPage({ params }: Props) {
  const { slug, postSlug } = await params;
  const profile = await getPublicProfile(slug, "realtor");
  if (!profile) notFound();
  const post = await getPublishedPost(profile.id, postSlug);
  if (!post) notFound();
  return <PostView profile={profile} post={post} />;
}
