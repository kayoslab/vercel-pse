import "server-only";
import { commerce } from "@/lib/commerce";
import type { StockLevel } from "@/lib/commerce";

/**
 * Stock — deliberately uncached.
 *
 * There is no `use cache` here and there must not be. The upstream recomputes
 * stock on every request (three consecutive calls for the same product
 * returned 2, 9 and 19), so any cached value is not merely stale, it is
 * fiction. Caching it would mean showing "in stock" for a sold-out item and
 * letting a customer add it to their cart.
 *
 * This makes every caller a dynamic hole. That is the intended shape: the
 * product page prerenders its shell — image, name, price, description — and
 * streams this one value in behind a Suspense boundary. Availability is the
 * only thing a shopper waits for, and only for as long as the upstream takes.
 *
 * Note the deliberate asymmetry with `cacheLife('seconds')`: Next.js
 * automatically excludes very short-lived caches from prerenders and turns
 * them into dynamic holes anyway, so a nominal cache here would buy nothing
 * but the false impression that stock is cached.
 */
export async function getStock(idOrSlug: string): Promise<StockLevel> {
  return commerce.getStock(idOrSlug);
}

