import "server-only";
import type { Metadata } from "next";
import { getStoreConfig } from "@/lib/data/store";

/**
 * Absolute base for anything that must be a full URL — Open Graph tags, the
 * sitemap, robots. Vercel supplies the production hostname as a system env
 * var, so no per-environment configuration; the localhost fallback keeps
 * local builds honest.
 */
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

type PageMetadataInput = {
  /** Page name only — the store name is appended where the template cannot. */
  title: string;
  description: string;
  /** Route path, used for the canonical URL and `og:url`. */
  path: string;
  /**
   * Set on pages in the **root route segment** (only `app/page.tsx`).
   *
   * Next.js applies `title.template` to *child* segments and explicitly not to
   * the segment where it is defined, so a title in `app/page.tsx` never picks
   * up the root layout's suffix. Rather than leaving the homepage — the page
   * most likely to be shared — without its brand name, these pages opt into an
   * absolute title that includes it. Child routes like `/search` inherit the
   * template normally and must leave this off, or the suffix appears twice.
   */
  rootSegment?: boolean;
};

/**
 * Builds page metadata consistently.
 *
 * This exists because Next.js merges metadata **shallowly**: a nested field
 * like `openGraph` defined in a page *replaces* the root layout's version
 * outright rather than merging into it. Any page that sets an Open Graph title
 * therefore silently drops `og:site_name`, `og:type` and `og:locale` unless it
 * restates them. Doing that by hand on every page is exactly the sort of thing
 * that is correct on the first page and wrong by the fourth, so it happens
 * here once.
 *
 * `getStoreConfig` is cached with a `days` profile, so the store name costs no
 * request per page.
 */
export async function pageMetadata({
  title,
  description,
  path,
  rootSegment = false,
}: PageMetadataInput): Promise<Metadata> {
  const { storeName } = await getStoreConfig();
  const socialTitle = rootSegment ? `${title} | ${storeName}` : title;

  return {
    title: rootSegment ? { absolute: socialTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: storeName,
      title: socialTitle,
      description,
      url: path,
      locale: "en_US",
      /*
       * The default share card, stated explicitly for the same shallow-merge
       * reason this helper exists: the root `app/opengraph-image.tsx` file
       * convention attaches its image at the root segment, but a child page
       * defining `openGraph` replaces the parent's resolved object — images
       * included — so /search, /products and /cart shipped imageless cards.
       * The root-segment page skips this: the file convention already tags it,
       * and adding a second reference would emit a duplicate og:image.
       * Pages with a better image (the PDP's product shot) override this.
       */
      ...(rootSegment
        ? {}
        : {
            images: [
              {
                url: "/opengraph-image",
                width: 1200,
                height: 630,
                alt: `${storeName} — official merchandise`,
              },
            ],
          }),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
    },
  };
}
