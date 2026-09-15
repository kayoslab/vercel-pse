import type { MetadataRoute } from "next";
import { getAllProductSlugs } from "@/lib/data/catalogue";
import { SITE_URL } from "@/lib/seo";

/**
 * The sitemap: three listing surfaces plus every product page. Product slugs
 * come from the same cached read that powers `generateStaticParams`, so this
 * costs no extra upstream request and stays in step with what is actually
 * prerendered. `/cart` is deliberately absent — it is per-session and already
 * noindexed. `lastModified` is deliberately omitted: the API exposes no
 * honest change date, and a fabricated timestamp is worse for crawlers than
 * none.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getAllProductSlugs();

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/search`, changeFrequency: "weekly", priority: 0.5 },
    ...slugs.map((slug) => ({
      url: `${SITE_URL}/products/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
