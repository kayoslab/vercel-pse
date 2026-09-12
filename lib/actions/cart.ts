"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { cacheTags } from "@/lib/cache-tags";
import { commerce, isNotFound } from "@/lib/commerce";
import { isFrameworkControlFlow } from "@/lib/framework";
import { CART_COOKIE, readCartToken } from "@/lib/data/cart";

/**
 * Cart mutations.
 *
 * Server Actions rather than route handlers: the mutation runs on the server
 * with no client-side API surface, the bypass token never leaves the server,
 * and the response can invalidate caches in the same round trip.
 */

export type CartActionResult =
  | { ok: true; totalItems: number }
  | { ok: false; error: string };

/** 30 days is well beyond the API's 24h inactivity expiry — see `resolveCart`. */
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

async function createCartAndAdd(
  productId: string,
  quantity: number,
): Promise<CartActionResult> {
  const created = await commerce.createCart();
  await persistToken(created.token);
  const cart = await commerce.addToCart(created.token, productId, quantity);
  updateTag(cacheTags.cart(created.token));
  return { ok: true, totalItems: cart.totalItems };
}

export async function addToCart(
  productId: string,
  quantity: number,
): Promise<CartActionResult> {
  // Never trust a quantity from the client. The value was chosen against a
  // stock number rendered some time ago, and the input itself is a client
  // component whose bounds a determined visitor can simply edit.
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: "Please choose a valid quantity." };
  }

  try {
    // Re-read stock immediately before writing. The upstream recomputes it per
    // request, so the number the page rendered is already historical.
    const stock = await commerce.getStock(productId);

    if (!stock.inStock) {
      return { ok: false, error: "This item just went out of stock." };
    }
    if (quantity > stock.quantity) {
      return {
        ok: false,
        error: `Only ${stock.quantity} left — please reduce the quantity.`,
      };
    }

    const existing = await readCartToken();

    // Use an existing token optimistically rather than validating it first.
    // Measured against this API, cart creation costs ~3s and each round trip
    // ~0.5s, so a pre-flight `getCart` to check the token would add latency to
    // every single add in order to detect a condition that only occurs after
    // 24h of inactivity. Better to try the write and recover from the failure.
    if (existing) {
      try {
        const cart = await commerce.addToCart(existing, productId, quantity);
        updateTag(cacheTags.cart(existing));
        return { ok: true, totalItems: cart.totalItems };
      } catch (error) {
        if (isFrameworkControlFlow(error)) throw error;
        // A 404 here means the cart expired, not that the product is missing —
        // the stock check above already proved the product exists. So mint a
        // replacement and carry on rather than showing the shopper an error
        // they cannot act on.
        if (!isNotFound(error)) throw error;
      }
    }

    return await createCartAndAdd(productId, quantity);
  } catch (error) {
    if (isNotFound(error)) {
      return { ok: false, error: "That product is no longer available." };
    }
    console.error("addToCart failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Sets the quantity of a line, or removes it when quantity is 0.
 *
 * Stock is re-checked here for the same reason as `addToCart`, and with more
 * force: the commerce API accepts *any* quantity on a cart write. Verified
 * against it — `PATCH { quantity: 9999 }` returns 200 and a cart subtotal of
 * $179,982. Every guard against overselling is this application's
 * responsibility, so it cannot be skipped on the grounds that the UI already
 * bounds the input. The input is a Client Component; its bounds are a
 * suggestion.
 */
export async function updateCartItem(
  productId: string,
  quantity: number,
): Promise<CartActionResult> {
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, error: "Please choose a valid quantity." };
  }
  if (quantity === 0) return removeCartItem(productId);

  const token = await readCartToken();
  if (!token) return { ok: false, error: "Your cart has expired." };

  try {
    const stock = await commerce.getStock(productId);
    if (!stock.inStock) {
      return { ok: false, error: "This item is no longer in stock." };
    }
    if (quantity > stock.quantity) {
      return { ok: false, error: `Only ${stock.quantity} available.` };
    }

    const cart = await commerce.updateCartItem(token, productId, quantity);
    updateTag(cacheTags.cart(token));
    return { ok: true, totalItems: cart.totalItems };
  } catch (error) {
    if (isFrameworkControlFlow(error)) throw error;
    if (isNotFound(error)) return { ok: false, error: "That item is no longer in your cart." };
    console.error("updateCartItem failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Removes a line entirely.
 *
 * No stock check: removing can never oversell, so there is nothing to validate
 * and no reason to spend a round trip. This is also the one mutation safe to
 * treat as optimistic on the client without reconciliation anxiety.
 */
export async function removeCartItem(productId: string): Promise<CartActionResult> {
  const token = await readCartToken();
  if (!token) return { ok: false, error: "Your cart has expired." };

  try {
    const cart = await commerce.removeCartItem(token, productId);
    updateTag(cacheTags.cart(token));
    return { ok: true, totalItems: cart.totalItems };
  } catch (error) {
    if (isFrameworkControlFlow(error)) throw error;
    // Already gone is the outcome the caller wanted.
    if (isNotFound(error)) return { ok: true, totalItems: 0 };
    console.error("removeCartItem failed", error);
    return { ok: false, error: "Could not remove that item. Please try again." };
  }
}
