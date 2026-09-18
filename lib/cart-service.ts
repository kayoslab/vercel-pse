import { commerce, isNotFound, type Cart, type StockLevel } from "@/lib/commerce";
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
  /**
   * `stock` rides along when the failure was a stock rejection: the guard has
   * just read the real availability, and the caller's UI may still be showing
   * an older snapshot ("In stock" beside "out of stock" in the error). Handing
   * the reading back lets label, ceiling and message agree on one number.
   *
   * `cartMissing` marks the one failure that means "this token no longer has a
   * cart behind it" — the signal a caller needs before minting a replacement.
   * It must never be inferred from `ok: false` alone: a stock rejection is
   * also a failure, and treating it as a dead cart replaces the shopper's
   * live cart with an empty one.
   */
  | { ok: false; error: string; stock?: StockLevel; cartMissing?: boolean };

async function guardStock(
  productId: string,
  quantity: number,
): Promise<{ ok: true } | { ok: false; error: string; stock: StockLevel }> {
  const stock = await commerce.getStock(productId);
  if (!stock.inStock) return { ok: false, error: "This item is out of stock.", stock };
  if (quantity > stock.quantity) {
    return { ok: false, error: `Only ${stock.quantity} available.`, stock };
  }
  return { ok: true };
}

function toFailure(error: unknown, fallback: string): CartOperationResult {
  if (isFrameworkControlFlow(error)) throw error;
  // Upstream 404s here after the guard has passed, which leaves two causes:
  // the product vanished, or the cart token expired. The API's envelope does
  // not distinguish them, so this reports both facts and the caller decides —
  // a UI add retries once against a fresh cart (and if the product truly is
  // gone, that retry fails the same way and the message stands).
  if (isNotFound(error)) {
    return { ok: false, error: "That item is no longer available.", cartMissing: true };
  }
  console.error(fallback, error);
  return { ok: false, error: fallback };
}

/**
 * Adds to the existing quantity — the upstream POST is additive, not absolute.
 *
 * That additivity is why the guard has to read the cart. Validating only the
 * increment against stock looks correct and is not: with 13 in stock, six adds of
 * 10 each pass individually and leave 60 units in the cart. Found by driving the
 * MCP endpoint in a loop, but the UI path had the same hole — it just takes more
 * clicking. What must be checked is the *resulting* quantity.
 *
 * The two reads run in parallel so the correctness fix costs one round trip
 * rather than two.
 *
 * `knownCart` lets a caller that already holds the current cart skip the read
 * entirely. The one caller today is the first-add path, which has just created
 * the cart — empty by construction — and the API's cart endpoints are slow
 * enough (~1.7s measured for `GET /cart`) that re-fetching a value we hold is
 * a full second and a half of spinner. `null` means "known to have no cart";
 * only `undefined` triggers the fetch.
 */
export async function addItem(
  token: string,
  productId: string,
  quantity: number,
  knownCart?: Cart | null,
): Promise<CartOperationResult> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: "Quantity must be a whole number of at least 1." };
  }

  try {
    const [stock, existingCart] = await Promise.all([
      commerce.getStock(productId),
      knownCart !== undefined ? knownCart : commerce.getCart(token),
    ]);

    if (!stock.inStock) {
      return { ok: false, error: "This item is out of stock.", stock };
    }

    const alreadyInCart =
      existingCart?.lines.find((line) => line.productId === productId)?.quantity ?? 0;
    const resulting = alreadyInCart + quantity;

    if (resulting > stock.quantity) {
      const headroom = Math.max(0, stock.quantity - alreadyInCart);
      // Three phrasings, because "only 7 more available — your cart already has
      // 0" is the kind of copy that makes a shopper distrust the number.
      if (alreadyInCart === 0) {
        return { ok: false, error: `Only ${stock.quantity} available.`, stock };
      }
      return {
        ok: false,
        error:
          headroom === 0
            ? `Your cart already has all ${stock.quantity} available.`
            : `Only ${headroom} more available — your cart already has ${alreadyInCart}.`,
        stock,
      };
    }

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
