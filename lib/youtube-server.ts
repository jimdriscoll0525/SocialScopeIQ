import { cache } from "react";
import { youtubeThumbnails } from "./youtube";

// maxresdefault.jpg doesn't exist for every video (404s on older/low-res
// uploads and sometimes for the first hours after upload) — fall back to
// hqdefault.jpg, which always exists. React cache() dedups the HEAD across
// generateMetadata and PostView within a request; the pages' ISR revalidate
// bounds how often it runs. (Deliberately not relying on the Next data cache:
// non-GET requests aren't dependably cached there. Also deliberately a
// separate file from youtube.ts: React's cache() doesn't exist in client
// bundles, and the client-side BlogManager imports parseYouTubeId.)
export const resolveYoutubeThumbnail = cache(async (videoId: string): Promise<string> => {
  const { maxres, hq } = youtubeThumbnails(videoId);
  try {
    const res = await fetch(maxres, { method: "HEAD" });
    return res.ok ? maxres : hq;
  } catch {
    return hq;
  }
});
