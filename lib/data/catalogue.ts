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

export type CatalogueQuery = {
  readonly query?: string;
  readonly category?: string;
  readonly page?: number;
  readonly limit?: number;
};

/**
 * One cached read behind both the catalogue page and the search page.
 *
 * The two differ only in which parameters they supply — the catalogue browses
 * by category and page, search narrows by term — so they share this rather than
 * each growing their own fetch. Results are dynamic *per request* but cacheable
 * *per parameter set*: the page reads `searchParams` at request time, which
 * cannot be cached, and passes plain values in here. Next.js derives the cache
 * key from those arguments, so two shoppers on page 2 of "bags" share an entry
 * while the page itself stays dynamic. That is the documented way to combine
 * runtime data with caching — read the runtime API outside the cached scope.
 *
 * Tagged `products` so a catalogue change sweeps every cached parameter
 * combination rather than leaving stale listings behind.
 */
export async function listCatalogue({
  query,
  category,
  page,
  limit,
}: CatalogueQuery): Promise<Page<Product>> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.products);

  return commerce.listProducts({
    search: query?.trim() || undefined,
    category: category || undefined,
    page,
    limit,
  });
}

export type CategoryFacet = {
  readonly slug: string;
  readonly name: string;
  readonly count: number;
};

/**
 * Category options with counts that reflect the current search.
 *
 * A filter labelled "Mugs (2)" while searching "hoodie" is a lie — there are
 * two mugs in the catalogue and none of them match. Counts have to be computed
 * against the result set the shopper is actually looking at, which is what
 * facets mean in commerce. Categories with no matches are dropped: offering a
 * filter that leads to a guaranteed empty result is worse than not offering it.
 *
 * Counts deliberately ignore the selected category. A facet's own dimension is
 * excluded from its own counts, otherwise picking "Bags" would collapse the list
 * to Bags alone and there would be no way to see what else was available.
 *
 * Scale note: this derives counts by fetching all matches and grouping them,
 * which is honest for a 28-product catalogue and wrong for a large one. A real
 * store needs facet counts from the search backend — a single aggregation rather
 * than a full scan. Flagged rather than hidden because it is the first thing
 * that would have to change.
 */
export async function getCategoryFacets(query?: string): Promise<readonly CategoryFacet[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.products, cacheTags.categories);

  const categories = await commerce.listCategories();
  const term = query?.trim();

  if (!term) {
    // No search: the API's own per-category totals are authoritative and cost
    // nothing extra.
    return categories
      .filter((c) => c.productCount > 0)
      .map((c) => ({ slug: c.slug, name: c.name, count: c.productCount }));
  }

  const matches = await commerce.listProducts({ search: term, limit: 100 });

  const counts = new Map<string, number>();
  for (const product of matches.items) {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }

  return categories
    .map((c) => ({ slug: c.slug, name: c.name, count: counts.get(c.slug) ?? 0 }))
    .filter((c) => c.count > 0);
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
