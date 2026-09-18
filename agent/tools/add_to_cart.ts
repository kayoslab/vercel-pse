import { defineWorkflowTool, type WorkflowToolContext } from "eve/tools";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";
import { cartTokenOf, NO_CART_REASON } from "../lib/session";

/**
 * Adding to the cart is the store's one write, and above a threshold it now
 * pauses for the shopper's explicit confirmation — a durable workflow wait,
 * not a UI trick. The confirmation card is rendered by the channel; the run
 * parks without holding compute until it is answered, minutes or days later,
 * and the model sees a single tool result either way.
 *
 * The threshold is value-based: $50 of merchandise is where an accidental or
 * misunderstood add starts to feel like a real mistake, and where an agent
 * writing to a cart should show its work. Below it, the add goes straight
 * through — a confirmation on every $8 pen would train shoppers to click
 * through the one that matters.
 *
 * The stock guard is unchanged and still lives in the shared cart service:
 * the confirmation gates *intent*, the guard gates *feasibility*, and both
 * gates run in that order so a shopper is never asked to approve an add that
 * was going to fail anyway. (The guard re-checks at add time regardless —
 * stock randomises per request, and approval can arrive much later.)
 */
const APPROVAL_THRESHOLD_CENTS = 5_000;

export default defineWorkflowTool({
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
  async execute({ productId, quantity }, ctx) {
    "use workflow";
    const requested = quantity ?? 1;
    const token = cartTokenOf(ctx.session);
    if (!token) return { added: false as const, reason: NO_CART_REASON };

    const product = await describeProduct(ctx, productId);
    if (!product) {
      return { added: false as const, reason: "That item is no longer available." };
    }

    const totalCents = product.priceCents * requested;
    if (totalCents >= APPROVAL_THRESHOLD_CENTS) {
      const answer = await ctx.ask({
        prompt:
          `Add ${requested} × ${product.name} to your cart for ${formatCents(totalCents)}?`,
        display: "confirmation",
        options: [
          { id: "approve", label: "Add to cart", style: "primary" },
          { id: "cancel", label: "Cancel" },
        ],
      });
      if (answer.optionId !== "approve") {
        return { added: false as const, reason: "The shopper declined the add." };
      }
    }

    return performAdd(token, productId, requested);
  },
});

/** Cents → "$50.00" without importing the app's Intl helper into the workflow body. */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function describeProduct(ctx: WorkflowToolContext, productId: string) {
  "use step";
  const details = await capabilities.getProductDetails({ idOrSlug: productId });
  if (!details.found) return null;
  return { name: details.product.name, priceCents: details.product.priceCents };
}

async function performAdd(token: string, productId: string, quantity: number) {
  "use step";
  return capabilities.addToCart(token, { productId, quantity });
}
