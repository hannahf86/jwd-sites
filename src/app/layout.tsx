// =============================================================================
// app/layout.tsx — root layout for the whole dashboard
// =============================================================================
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "JWD Sites", template: "%s · JWD Sites" },
  description: "Edit your website: pages, events, blog posts and images.",
  // A private tool. Nothing here should be in a search index.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
