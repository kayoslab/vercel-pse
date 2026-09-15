import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * `/cart` is per-session (and noindexed at the page level too — this is the
 * cheaper first line); `/api` is the agent surface, not content.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/cart", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
