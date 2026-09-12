import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { cacheTags } from "@/lib/cache-tags";
import { commerce } from "@/lib/commerce";
import type { Cart } from "@/lib/commerce";

/**
 * Cart read path.
 *
 * The cart itself lives in the commerce backend; all this app owns is the
 * token, held in an httpOnly cookie. Nothing here creates a cart — a visitor
 * who has not added anything should not cost an upstream write just for
 * rendering a header.
 */
export const CART_COOKIE = "cart_token";

export async function readCartToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value;
}

/**
 * Cached per token.
 *
 * Note the shape: the cookie is read in `getCurrentCart` — *outside* this
 * cached scope — and the token arrives here as an ordinary argument. Next.js
 * forbids reading `cookies()` inside `use cache`, and folds arguments into the
 * cache key, so passing the token in is both the required pattern and exactly
 * what makes the entry per-session.
 *
 * Caching this is a deliberate trade. The badge renders on every page, so
 * without it each navigation blocks a streamed hole on an upstream round trip.
 * The cost is that correctness now depends on every mutation calling
 * `updateTag(cacheTags.cart(token))` — a missed invalidation shows a customer
 * the wrong cart, which is a trust problem rather than a cosmetic one. The
 * short `minutes` profile bounds that blast radius; plain uncached reads are
 * the fallback if the invalidation discipline ever looks shaky.
 */
async function getCartByToken(token: string): Promise<Cart | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.cart(token));

  return commerce.getCart(token);
}

/** The visitor's cart, or `null` when they have not started one. */
export async function getCurrentCart(): Promise<Cart | null> {
  const token = await readCartToken();
  if (!token) return null;
  return getCartByToken(token);
}

/** Item count for the header badge. Cheap wrapper so callers need no null dance. */
export async function getCartItemCount(): Promise<number> {
  const cart = await getCurrentCart();
  return cart?.totalItems ?? 0;
}
