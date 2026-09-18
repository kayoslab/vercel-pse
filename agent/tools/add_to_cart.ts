import { defineTool } from "eve/tools";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";
import { replaceSessionCart, resolveCart } from "../lib/session-cart";

/**
 * Adding to the cart is the store's one write, and above a threshold it
 * pauses for the shopper's explicit sign-off — eve's `approval` policy, which
 * parks the run durably (seconds or days) and renders natively on every
 * channel: a confirmation card in the web panel, buttons in Slack.
 *
 * The policy is conditional and PRICED: it looks the product up and requires
 * approval only when the add is worth $50 or more. A confirmation on every
 * $8 pen would train shoppers to click through the one that matters. The
 * ordering is deliberate and free: approval gates *intent* before `execute`
 * runs; the shared stock guard gates *feasibility* inside it — so a shopper
 * is never asked to bless an add that was going to fail, and stock is still
 * re-checked at add time, however late the approval arrives.
 *
 * This is an ordinary tool, not a workflow, on purpose: the session-owned
 * cart lives in durable session state, which workflow steps cannot reach
 * (verified — writes land in a discarded scope). The approval policy gives
 * the same durable human pause without leaving ordinary context. Long-lived
 * *promises* (watch_stock) stay workflows; human *sign-off* is policy.
 */
const APPROVAL_THRESHOLD_CENTS = 5_000;

export default defineTool({
  description:
    "Add a product to the shopper's cart. Quantity adds to whatever is " +
    "already there rather than replacing it. Confirm which product they mean " +
    "before calling this. Adds worth $50 or more pause and ask the shopper " +
    "to confirm before anything changes — this is expected behaviour, not an " +
    "error; wait for the result.",
  inputSchema: z.object(capabilities.addToCartSchema),
  label: {
    start: ({ productId, quantity }) =>
      `Adding ${quantity ?? 1} × ${productId} to your cart`,
  },
  approval: async ({ toolInput }) => {
    const productId = (toolInput as { productId?: unknown })?.productId;
    if (typeof productId !== "string") return "not-applicable";
    const quantity =
      typeof (toolInput as { quantity?: unknown })?.quantity === "number"
        ? ((toolInput as { quantity: number }).quantity)
        : 1;

    const details = await capabilities.getProductDetails({ idOrSlug: productId });
    if (!details.found) return "not-applicable"; // execute will report the real error
    return details.product.priceCents * quantity >= APPROVAL_THRESHOLD_CENTS
      ? "user-approval"
      : "not-applicable";
  },
  async execute({ productId, quantity }, ctx) {
    const requested = quantity ?? 1;
    const cart = await resolveCart(ctx);
    const first = await capabilities.addToCart(cart.token, {
      productId,
      quantity: requested,
    });

    /*
     * A session-owned cart can die like any other (24h upstream idle). The
     * browser path heals at the cookie seam; here the session heals itself:
     * mint a replacement, remember it, retry exactly once. Only for
     * state-sourced tokens — a dead *cookie* cart is the storefront's to
     * replace, since a token minted here would diverge from the badge.
     */
    if (!first.added && first.staleCart && cart.source === "state") {
      const fresh = await replaceSessionCart();
      return capabilities.addToCart(fresh, { productId, quantity: requested });
    }

    if (!first.added && first.staleCart && cart.source === "cookie") {
      return {
        added: false as const,
        reason:
          "The shopper's cart session has expired. Ask them to reload the page and try again — a fresh cart will be set up automatically.",
      };
    }

    return first;
  },
});
