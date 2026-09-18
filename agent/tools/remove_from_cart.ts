import { defineTool } from "eve/tools";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";
import { currentCartToken } from "../lib/session-cart";

export default defineTool({
  description:
    "Remove a product from the shopper's cart entirely. Only when they " +
    "clearly ask for it. Removing cannot oversell, so it needs no stock check " +
    "and no confirmation.",
  inputSchema: z.object(capabilities.removeFromCartSchema),
  label: {
    start: ({ productId }) => `Removing ${productId} from your cart`,
  },
  async execute(input, ctx) {
    const token = currentCartToken(ctx);
    if (!token) {
      return { changed: false as const, reason: "The cart is empty — there is nothing to remove." };
    }
    return capabilities.removeFromCart(token, input);
  },
});
