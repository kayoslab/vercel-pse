"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { cacheTags } from "@/lib/cache-tags";
import {
  addItem,
  removeItem,
  setQuantity,
  type CartOperationResult,
} from "@/lib/cart-service";
import { commerce } from "@/lib/commerce";
import { CART_COOKIE, readCartToken } from "@/lib/data/cart";

/**
 * Cart mutations from the UI.
 *
 * These are thin: the guards and upstream calls live in `lib/cart-service`,
 * because the agent tools and the MCP server reach the same operations and the
 * stock guard must be identical everywhere. What is specific to this entry point
 * is the session — a cookie — and the cache invalidation.
 *
 * `updateTag` rather than `revalidateTag`: this is read-your-own-writes, and
 * serving a stale cart after a mutation reads as the action having failed.
 */

export type CartActionResult =
  | { ok: true; totalItems: number }
  | { ok: false; error: string };

/** 30 days, well beyond the API's 24h inactivity expiry. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

async function persistToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, token, {
    // Never readable from JavaScript: the token is the only credential
    // protecting the cart, so an XSS bug must not be able to lift it.
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Runs an operation against the visitor's cart, creating one on first use.
 *
 * An existing token is used optimistically rather than validated first: cart
 * creation costs ~3s against this API and a pre-flight check would tax every
 * mutation to detect a condition that only occurs after 24h of inactivity. If
 * the token turns out to be dead the operation reports NOT_FOUND and a
 * replacement cart is minted — for an add. For an update or removal there is
 * nothing worth recovering, so the shopper is simply told the cart expired.
 */
async function withCart(
  operate: (token: string) => Promise<CartOperationResult>,
  options: { createIfMissing: boolean },
): Promise<CartActionResult> {
  const existing = await readCartToken();

  if (existing) {
    const result = await operate(existing);
    if (result.ok) {
      updateTag(cacheTags.cart(existing));
      return { ok: true, totalItems: result.cart.totalItems };
    }
    if (!options.createIfMissing) return { ok: false, error: result.error };
  }

  if (!options.createIfMissing) {
    return { ok: false, error: "Your cart has expired." };
  }

  const created = await commerce.createCart();
  await persistToken(created.token);
  const result = await operate(created.token);
  if (!result.ok) return { ok: false, error: result.error };
  updateTag(cacheTags.cart(created.token));
  return { ok: true, totalItems: result.cart.totalItems };
}

export async function addToCart(
  productId: string,
  quantity: number,
): Promise<CartActionResult> {
  return withCart((token) => addItem(token, productId, quantity), {
    createIfMissing: true,
  });
}

export async function updateCartItem(
  productId: string,
  quantity: number,
): Promise<CartActionResult> {
  return withCart((token) => setQuantity(token, productId, quantity), {
    createIfMissing: false,
  });
}

export async function removeCartItem(productId: string): Promise<CartActionResult> {
  return withCart((token) => removeItem(token, productId), {
    createIfMissing: false,
  });
}
