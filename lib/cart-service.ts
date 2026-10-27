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
 * called from a Server Action, and two of the three entry points (the eve
 * agent's tools, the MCP server) run outside this app's Server Action context
 * entirely — their invalidation happens from the client, via the
 * refreshCartCache Server Action. The caller owns that decision, and this
 * stays callable from all three.
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

function rejection(
  stock: StockLevel,
  quantity: number,
  alreadyInCart: number,
): { error: string } | null {
  if (!stock.inStock) return { error: "This item is out of stock." };
  if (alreadyInCart + quantity <= stock.quantity) return null;
  const headroom = Math.max(0, stock.quantity - alreadyInCart);
  // Three phrasings, because "only 7 more available — your cart already has
  // 0" is the kind of copy that makes a shopper distrust the number.
  if (alreadyInCart === 0) return { error: `Only ${stock.quantity} available.` };
  return {
    error:
      headroom === 0
        ? `Your cart already has all ${stock.quantity} available.`
        : `Only ${headroom} more available — your cart already has ${alreadyInCart}.`,
  };
}

/**
 * Adds to the existing quantity — the upstream POST is additive, not absolute.
 *
 * The guard checks the *resulting* quantity, not the increment. Validating the
 * increment alone looks correct and is not: with 13 in stock, six adds of 10
 * each pass individually and leave 60 units in the cart. Found by driving the
 * MCP endpoint in a loop, but the UI path had the same hole.
 *
 * The write and the stock read run concurrently, and the guard is applied to
 * the written result. This is a deliberate reordering for latency: against
 * this API a stock read costs ~2.7s and the add ~2.5s, and running them in
 * sequence made every add a five-second wait. Concurrently, an add costs the
 * slower of the two. The price is a window of about two seconds in which the
 * cart can hold an over-quantity before the compensation below restores the
 * previous line — invisible to the shopper, whose UI shows the add as pending
 * throughout, and reported honestly as a rejection when it happens. The
 * response of the POST carries the resulting cart, so no separate cart read is
 * needed to know what was in the line before; that removed another ~1.7s.
 */
export async function addItem(
  token: string,
  productId: string,
  quantity: number,
): Promise<CartOperationResult> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: "Quantity must be a whole number of at least 1." };
  }

  try {
    const [stock, cart] = await Promise.all([
      commerce.getStock(productId),
      commerce.addToCart(token, productId, quantity),
    ]);

    const lineAfter = cart.lines.find((line) => line.productId === productId)?.quantity ?? quantity;
    const alreadyInCart = Math.max(0, lineAfter - quantity);
    const rejected = rejection(stock, quantity, alreadyInCart);
    if (!rejected) return { ok: true, cart };

    // Compensate: put the line back the way it was, then report the rejection
    // with the reading it was based on.
    if (alreadyInCart === 0) await commerce.removeCartItem(token, productId);
    else await commerce.updateCartItem(token, productId, alreadyInCart);
    return { ok: false, error: rejected.error, stock };
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
