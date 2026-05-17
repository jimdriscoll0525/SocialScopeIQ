import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
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
