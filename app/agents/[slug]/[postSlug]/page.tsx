import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile, getPublishedPost } from "@/lib/public-blog";
import { heroForSlug } from "@/lib/blog-images";
import { resolveYoutubeThumbnail } from "@/lib/youtube-server";
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
      // Video posts share the YouTube thumbnail; React cache() dedups the
      // HEAD check with PostView's call in the same request.
      images: [{ url: post.video_id ? await resolveYoutubeThumbnail(post.video_id) : heroForSlug(post.slug) }]
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
