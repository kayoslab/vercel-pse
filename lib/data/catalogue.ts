import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { commerce } from "@/lib/commerce";
import type { Page, Product } from "@/lib/commerce";

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

/**
 * The upstream caps a page at 100 and the catalogue has 28 products, so one
 * read is the whole catalogue. Flagged rather than hidden: product #101 would
 * vanish from search, the sitemap and generateStaticParams alike, and the fix
 * at that size is a search backend, not a bigger limit.
 */
const CATALOGUE_LIMIT = 100;

/**
 * The whole catalogue, one cached read shared across instances.
 *
 * This is what makes search and the catalogue listing fast against a slow
 * upstream. Every query used to be its own upstream round trip (~1.7s, plus
 * ~2s for the facet counts), cached per parameter set — so the first visitor
 * for any term paid the full cost, and a reviewer typing freely paid it on
 * every keystroke past the threshold. Twenty-eight products fit in one
 * response; filtering them in-process costs microseconds. The remote handler
 * shares the entry across instances, so after the first read nobody pays the
 * upstream again for an hour.
 *
 * The honest scale note: this is right for 28 products and wrong for 100,000.
 * A real catalogue searches in a search backend with facet aggregations and
 * remote-caches by normalised query; the shape of `listCatalogue` and
 * `getCategoryFacets` below is the seam where that swap would happen.
 */
async function getCatalogue(): Promise<readonly Product[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(cacheTags.products);

  const page = await commerce.listProducts({ limit: CATALOGUE_LIMIT });
  return page.items;
}

export type CatalogueQuery = {
  readonly query?: string;
  readonly category?: string;
  readonly page?: number;
  readonly limit?: number;
};

const DEFAULT_PAGE_SIZE = 12;

/**
 * Word-wise AND match over name, description, tags and category, which is
 * the upstream's own search semantics as observed: every term has to appear
 * somewhere, case-insensitively.
 */
function matches(product: Product, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = [product.name, product.description, product.category, ...product.tags]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function searchTerms(query: string | undefined): readonly string[] {
  return (query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * One read behind both the catalogue page and the search page.
 *
 * The two differ only in which parameters they supply — the catalogue browses
 * by category and page, search narrows by term — so they share this rather
 * than each growing their own fetch. The page reads `searchParams` at request
 * time, which cannot be cached, and passes plain values in here; the only
 * cached thing is the catalogue itself, read once. The caller's boundary
 * placement is unchanged: results are still a dynamic hole keyed on the URL,
 * they just resolve from memory instead of from the upstream.
 */
export async function listCatalogue({
  query,
  category,
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
}: CatalogueQuery): Promise<Page<Product>> {
  const products = await getCatalogue();
  const terms = searchTerms(query);

  const filtered = products.filter(
    (product) => (!category || product.category === category) && matches(product, terms),
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * limit;

  return {
    items: filtered.slice(start, start + limit),
    pagination: {
      page: current,
      limit,
      total,
      totalPages,
      hasNextPage: current < totalPages,
      hasPreviousPage: current > 1,
    },
  };
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
 * Computed from the same cached catalogue as the results, so the counts and
 * the list can never disagree, and a search costs no upstream call at all.
 * Category display names come from the (cached) category list.
 */
export async function getCategoryFacets(query?: string): Promise<readonly CategoryFacet[]> {
  const [categories, products] = await Promise.all([getCategories(), getCatalogue()]);
  const terms = searchTerms(query);

  const counts = new Map<string, number>();
  for (const product of products) {
    if (!matches(product, terms)) continue;
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }

  return categories
    .map((c) => ({ slug: c.slug, name: c.name, count: counts.get(c.slug) ?? 0 }))
    .filter((c) => c.count > 0);
}

async function getCategories() {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(cacheTags.categories);

  return commerce.listCategories();
}

/**
 * Every product slug, for `generateStaticParams`.
 *
 * The catalogue is small enough (28 products) to prerender in full, so every
 * product page ships as a static shell with stock as its only dynamic hole.
 * A larger catalogue would prerender the top sellers here and let the rest
 * fill in on first request.
 */
export async function getAllProductSlugs(): Promise<readonly string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.products);

  const page = await commerce.listProducts({ limit: CATALOGUE_LIMIT });
  return page.items.map((product) => product.slug);
}
