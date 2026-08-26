import { buildRssResponse } from "@/lib/rss";

// Static "rss.xml" segment wins over the [postSlug] dynamic sibling, and the
// middleware matcher skips paths with a file extension, so this stays public.
// Regenerated at most every 15 minutes (ISR).
export const revalidate = 900;

type Props = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Props): Promise<Response> {
  const { slug } = await params;
  return buildRssResponse(slug, "loan_officer");
}
