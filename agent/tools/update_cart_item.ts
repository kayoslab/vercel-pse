import { defineTool } from "eve/tools";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";
import { currentCartToken } from "../lib/session-cart";

export default defineTool({
  description:
    "Set the absolute quantity of a product already in the shopper's cart " +
    "(0 removes it). Only when they clearly ask for a change. The server " +
    "re-checks stock for increases, so this can legitimately fail — relay " +
    "the returned reason.",
  inputSchema: z.object(capabilities.updateCartItemSchema),
  label: {
    start: ({ productId, quantity }) => `Setting ${productId} to ${quantity}`,
  },
  async execute(input, ctx) {
    const token = currentCartToken(ctx);
    if (!token) {
      return { changed: false as const, reason: "The cart is empty — there is nothing to change." };
    }
    return capabilities.updateCartItem(token, input);
  },
});
