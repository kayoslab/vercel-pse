import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartBadgeProvider } from "@/components/cart/cart-badge-context";
import { SiteFooter } from "@/components/layout/site-footer";
import { Assistant } from "@/components/agent/assistant";
import { SiteHeader } from "@/components/layout/site-header";
import { VercelToolbar } from "@vercel/toolbar/next";
import { getStoreConfig } from "@/lib/data/store";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/**
 * Root metadata is derived from the store's own configuration rather than
 * hardcoded, so the title template and default description stay owned by the
 * commerce backend. `getStoreConfig` is cached with a `days` profile, so this
 * costs no request per page despite running for every route.
 *
 * The `title.template` ("%s | Vercel Swag Store") comes straight from the API's
 * SEO defaults — each page supplies only its own name and inherits the suffix.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { seo, storeName } = await getStoreConfig();

  return {
    // Social crawlers do not resolve relative paths; this makes every
    // relative og:url/og:image absolute.
    metadataBase: new URL(SITE_URL),
    title: {
      default: seo.defaultTitle,
      template: seo.titleTemplate,
    },
    description: seo.defaultDescription,
    openGraph: {
      type: "website",
      siteName: storeName,
      title: seo.defaultTitle,
      description: seo.defaultDescription,
      url: "/",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.defaultTitle,
      description: seo.defaultDescription,
    },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        {/*
          Client context sharing the pending cart delta between the header
          badge and the cart page, so the two cannot disagree while a slow
          mutation is in flight. Deterministic, so it costs the static shell
          nothing; the server components inside stay server components.
        */}
        <CartBadgeProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
        </CartBadgeProvider>
        <SiteFooter />
        {/*
          Fixed overlay, so it cannot shift any page it sits on.

          The Suspense boundary is required, not stylistic: the assistant is a
          client island with request-time, non-deterministic state (the durable
          session cursor restored from sessionStorage, the streaming hook's
          ids), and Cache Components rejects non-determinism in a Client
          Component with no boundary above it — the build fails outright. The
          boundary scopes the assistant to request time and leaves every page's
          static shell intact. A null fallback is fine here because this is a
          floating button, not content in the document flow, so nothing moves
          when it arrives.
        */}
        <Suspense fallback={null}>
          <Assistant />
        </Suspense>
        {/* Local-dev only: on Vercel deployments the platform injects the toolbar. */}
        {process.env.NODE_ENV === "development" && <VercelToolbar />}
      </body>
    </html>
  );
}
