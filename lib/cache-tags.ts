/**
 * Cache tag vocabulary.
 *
 * Tags are the invalidation contract between readers (`cacheTag` inside a
 * `use cache` scope) and writers (`updateTag` / `revalidateTag` in Server
 * Actions). Keeping them here rather than as string literals at call sites
 * means a typo cannot silently produce a cache entry nobody can ever
 * invalidate — the failure mode being stale prices served indefinitely.
 *
 * Next.js caps tags at 256 characters and treats them as case-sensitive.
 */
export const cacheTags = {
  /** Every catalogue read — product lists, search results, single products. */
  products: "products",

  /** A single product, for targeted invalidation without dumping the catalogue. */
  product: (idOrSlug: string) => `product:${idOrSlug}`,

  categories: "categories",

  storeConfig: "store-config",

  /** Per-session cart. The token is opaque and already unguessable. */
  cart: (token: string) => `cart:${token}`,
} as const;
