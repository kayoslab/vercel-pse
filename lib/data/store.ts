import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { commerce } from "@/lib/commerce";
import type { StoreConfig } from "@/lib/commerce";

/**
 * Store configuration — currency, SEO defaults, social links.
 *
 * Cached hard. This feeds the root layout's metadata, so it is read on every
 * route; an uncached call here would make a network request a prerequisite for
 * rendering any page's `<head>`, which is exactly the kind of dependency that
 * turns one slow upstream into a site-wide slowdown.
 *
 * `days` rather than `max`: store configuration changes rarely, but a 30-day
 * revalidation window would mean a corrected store name or description sits
 * wrong for a month unless someone remembers to invalidate the tag.
 */
export async function getStoreConfig(): Promise<StoreConfig> {
  // Remote so dynamic renders (search, PLP, cart) share one entry across
  // instances instead of re-fetching the config per request.
  "use cache: remote";
  cacheLife("days");
  cacheTag(cacheTags.storeConfig);

  return commerce.getStoreConfig();
}
