// Email notifications to the MEP marketing team when a blog post first goes
// live, so they can review it for placement on the MEP site. Uses the same
// Resend REST pattern as /api/lead-capture: no SDK, log-only when the key is
// unset, and failures never block the publish itself.
//
// NOTE: until a sending domain is verified in Resend, the default
// onboarding@resend.dev sender only delivers to the Resend account owner's
// address — external recipients are rejected with a 403. Verify a domain and
// set RESEND_FROM_EMAIL to unlock delivery to the addresses below.

const DEFAULT_REVIEW_EMAILS = "morchanian@meploans.com,asullivan@meploans.com";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface BlogReviewNotice {
  title: string;
  metaDescription: string | null;
  url: string;
  authorName: string;
}

export async function sendBlogReviewEmail(notice: BlogReviewNotice): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "SocialScopeIQ <onboarding@resend.dev>";
  const to = (process.env.BLOG_REVIEW_EMAILS || DEFAULT_REVIEW_EMAILS)
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (to.length === 0) return;

  const subject = `New blog post from ${notice.authorName}: ${notice.title}`;
  const html = `
    <p>Hi,</p>
    <p>${escapeHtml(notice.authorName)} just published a new blog post and would like you to
    review it for placement on the MEP site:</p>
    <p><strong><a href="${escapeHtml(notice.url)}">${escapeHtml(notice.title)}</a></strong></p>
    ${notice.metaDescription ? `<p>${escapeHtml(notice.metaDescription)}</p>` : ""}
    <p><a href="${escapeHtml(notice.url)}">${escapeHtml(notice.url)}</a></p>
    <p>Thanks!</p>`;

  if (!apiKey) {
    console.log("[notify] RESEND_API_KEY not set — would send blog review email:", { to, subject });
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html })
    });
    if (!res.ok) {
      console.error("[notify] blog review email failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[notify] blog review email failed:", e);
  }
}
