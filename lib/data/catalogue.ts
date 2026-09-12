import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { commerce } from "@/lib/commerce";
import type { Category, Page, Product } from "@/lib/commerce";

/**
 * Cached catalogue reads.
 *
 * Everything here is deliberately cached and tagged. Catalogue data is the
 * storefront's most-read and least-volatile data, so caching it is what lets
 * the homepage and every product page ship as a prerendered static shell
 * served from the CDN rather than as a function invocation per visitor.
 *
 * `hours` is the profile Next.js documents for "content updated multiple times
 * per day", which is the right shape for a product catalogue: 1 hour
 * background revalidation, 1 day hard expiry, 5 minutes of client staleness.
 * Between revalidations the cache serves stale content rather than blocking —
 * which is also the availability property that matters most here. If the
 * commerce backend goes down, the catalogue keeps serving until `expire`
 * rather than the storefront going down with it.
 *
 * Every entry carries the `products` tag so a single `updateTag` after a
 * catalogue change invalidates lists, search results, and detail pages
 * together. Detail pages additionally carry a per-product tag so a single
 * price correction does not have to dump the whole catalogue.
 */

export async function getFeaturedProducts(limit = 6): Promise<readonly Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.products);

  const page = await commerce.listProducts({ featured: true, limit });
  return page.items;
}

export async function getProduct(idOrSlug: string): Promise<Product | null> {
  "use cache";
  cacheLife("hours");
  // Tagged both ways: `products` for a catalogue-wide sweep, `product:<id>`
  // for a targeted correction.
  cacheTag(cacheTags.products, cacheTags.product(idOrSlug));

  return commerce.getProduct(idOrSlug);
}

export async function getCategories(): Promise<readonly Category[]> {
  "use cache";
  // Categories are effectively structural — they change when the merchandising
  // team restructures the store, not during a normal trading day.
  cacheLife("days");
  cacheTag(cacheTags.categories);

  return commerce.listCategories();
}

export type SearchParams = {
  readonly query?: string;
  readonly category?: string;
  readonly limit?: number;
};

/**
 * Search is dynamic *per request* but cacheable *per query*.
 *
 * The page reads `searchParams` at request time — that part cannot be cached —
 * and passes the values in here as plain arguments. Next.js derives the cache
 * key from those arguments, so two shoppers searching "hoodie" share a cache
 * entry while the page itself stays dynamic. This is the documented pattern for
 * combining runtime data with caching: read the runtime API outside the cached
 * scope, pass values in.
 *
 * Tagged `products` so a catalogue change sweeps every cached result set
 * rather than leaving stale search results behind.
 */
export async function searchProducts({
  query,
  category,
  limit = 5,
}: SearchParams): Promise<Page<Product>> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.products);

  return commerce.listProducts({
    search: query?.trim() || undefined,
    category: category || undefined,
    limit,
  });
}

/**
 * Every product slug, for `generateStaticParams`.
 *
 * The catalogue is small enough (28 products) to prerender in full, so every
 * product page ships as a static shell with stock as its only dynamic hole.
 * A larger catalogue would prerender the top sellers here and let the rest
 * fill in on first request.
 *
 * The limit is explicit rather than paging to exhaustion: an unbounded loop
 * against a third-party API at build time is how a build starts timing out
 * the day someone adds ten thousand SKUs.
 */
export async function getAllProductSlugs(): Promise<readonly string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.products);

  const page = await commerce.listProducts({ limit: 100 });
  return page.items.map((product) => product.slug);
}
