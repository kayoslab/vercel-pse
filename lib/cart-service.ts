import "server-only";
import { commerce, isNotFound, type Cart } from "@/lib/commerce";
import { isFrameworkControlFlow } from "@/lib/framework";

/**
 * Cart operations with their guards, independent of how the caller was invoked.
 *
 * This exists because the same operations are now reachable three ways — a
 * Server Action from the UI, an in-app agent tool, and an MCP tool driven by an
 * external agent — and the stock guard must be identical in all three. A guard
 * duplicated per entry point is a guard that will eventually differ in one of
 * them, and the commerce API enforces nothing itself: it happily accepts
 * `quantity: 9999`.
 *
 * Cache invalidation is deliberately *not* done here. `updateTag` may only be
 * called from a Server Action, while a Route Handler must use `revalidateTag`,
 * so the caller owns that decision and this stays callable from both.
 */

export type CartOperationResult =
  | { ok: true; cart: Cart }
  | { ok: false; error: string };

async function guardStock(
  productId: string,
  quantity: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const stock = await commerce.getStock(productId);
  if (!stock.inStock) return { ok: false, error: "This item is out of stock." };
  if (quantity > stock.quantity) {
    return { ok: false, error: `Only ${stock.quantity} available.` };
  }
  return { ok: true };
}

function toFailure(error: unknown, fallback: string): CartOperationResult {
  if (isFrameworkControlFlow(error)) throw error;
  if (isNotFound(error)) return { ok: false, error: "That item is no longer available." };
  console.error(fallback, error);
  return { ok: false, error: fallback };
}

/** Adds to the existing quantity — the upstream POST is additive, not absolute. */
export async function addItem(
  token: string,
  productId: string,
  quantity: number,
): Promise<CartOperationResult> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: "Quantity must be a whole number of at least 1." };
  }

  try {
    const guard = await guardStock(productId, quantity);
    if (!guard.ok) return guard;
    return { ok: true, cart: await commerce.addToCart(token, productId, quantity) };
  } catch (error) {
    return toFailure(error, "Could not add that item.");
  }
}

/** Sets an absolute quantity; 0 removes the line. */
export async function setQuantity(
  token: string,
  productId: string,
  quantity: number,
): Promise<CartOperationResult> {
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, error: "Quantity must be a whole number of at least 0." };
  }
  if (quantity === 0) return removeItem(token, productId);

  try {
    const guard = await guardStock(productId, quantity);
    if (!guard.ok) return guard;
    return { ok: true, cart: await commerce.updateCartItem(token, productId, quantity) };
  } catch (error) {
    return toFailure(error, "Could not update that item.");
  }
}

/** No stock guard: removing cannot oversell, so a round trip would be waste. */
export async function removeItem(
  token: string,
  productId: string,
): Promise<CartOperationResult> {
  try {
    return { ok: true, cart: await commerce.removeCartItem(token, productId) };
  } catch (error) {
    if (isFrameworkControlFlow(error)) throw error;
    // Already gone is the outcome the caller wanted.
    if (isNotFound(error)) {
      const cart = await commerce.getCart(token);
      if (cart) return { ok: true, cart };
    }
    return toFailure(error, "Could not remove that item.");
  }
}
