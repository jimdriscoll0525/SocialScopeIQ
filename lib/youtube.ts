// YouTube helpers. We only ever store the 11-character video ID — never a URL
// and never embed markup — so everything rendered from it (iframe src, JSON-LD,
// thumbnails) is constrained to the ID alphabet below.
// Pure and dependency-free: imported by the client-side BlogManager too.
// (The HEAD-checking thumbnail resolver lives in youtube-server.ts.)

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YT_HOSTS = /(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|^youtu\.be$/;

// Accepts watch?v=, youtu.be/, shorts/, embed/, v/ URLs (with or without a
// scheme, any youtube.com subdomain) or a bare 11-character ID. Returns null
// for anything else — including pasted <iframe> HTML — and never throws.
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.includes("<") || raw.includes(">")) return null;
  if (ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!YT_HOSTS.test(url.hostname.toLowerCase())) return null;

  const candidates: string[] = [];
  const v = url.searchParams.get("v");
  if (v) candidates.push(v);

  const segments = url.pathname.split("/").filter(Boolean);
  if (url.hostname.toLowerCase() === "youtu.be") {
    if (segments[0]) candidates.push(segments[0]);
  } else if (["shorts", "embed", "v", "live"].includes(segments[0] || "")) {
    if (segments[1]) candidates.push(segments[1]);
  }

  return candidates.find((c) => ID_RE.test(c)) || null;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function youtubeThumbnails(videoId: string): { maxres: string; hq: string } {
  return {
    maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    hq: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  };
}
