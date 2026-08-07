import "./globals.css";
import type { Metadata } from "next";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export const metadata: Metadata = {
  // Base for canonical/OG URLs site-wide. NEXT_PUBLIC_SITE_URL must match the
  // domain that actually serves content (https://www.socialscopeiq.com — the
  // apex redirects to www).
  metadataBase: new URL(siteUrl()),
  title: "SocialScopeIQ",
  description: "Lead dashboard for Mortgage Equity Partners"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
