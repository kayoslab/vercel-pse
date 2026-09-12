import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getStoreConfig } from "@/lib/data/store";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/**
 * Absolute base for Open Graph URLs. Social crawlers do not resolve relative
 * paths, so without this the preview image silently fails to load in exactly
 * the places a share is meant to work. Vercel supplies the production hostname
 * as a system environment variable, so this needs no manual configuration per
 * environment.
 */
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

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
    metadataBase: new URL(siteUrl),
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
