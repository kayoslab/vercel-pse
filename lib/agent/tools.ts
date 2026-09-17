import "server-only";
import { tool } from "ai";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";

/**
 * The in-app assistant's tools.
 *
 * Thin wrappers: every implementation lives in `capabilities.ts`, which the MCP
 * server calls too. What this file adds is the AI SDK envelope and the binding of
 * cart operations to *this* caller's session.
 *
 * The session is injected rather than read here, because the two surfaces resolve
 * it differently — a cookie in the browser, an explicit token over MCP — and the
 * capability functions must not care which.
 */
export type CartSession = {
  /** The caller's cart token, or throws if none exists. */
  ensure: () => Promise<string>;
  /** The caller's cart token if one already exists — never creates. */
  peek: () => Promise<string | undefined>;
  /** Invalidate cached reads of this cart. Server Actions and Route Handlers differ. */
  invalidate: (token: string) => void;
};

export function createCommerceTools(session: CartSession) {
  return {
    searchProducts: tool({
      description:
        "Search the store catalogue by free-text term, category and/or price " +
        "range. Use this first for any question about what the store sells. When " +
        "the shopper names a budget, pass it as maxPriceCents/minPriceCents — the " +
        "results are shown to them directly, so the search itself must respect " +
        "the limit.",
      inputSchema: z.object(capabilities.searchProductsSchema),
      execute: (input) => capabilities.searchProducts(input),
    }),

    getProductDetails: tool({
      description:
        "Full details for one product, by id or slug. Use after searchProducts " +
        "when the shopper asks about a specific item.",
      inputSchema: z.object(capabilities.getProductDetailsSchema),
      execute: (input) => capabilities.getProductDetails(input),
    }),

    checkStock: tool({
      description:
        "Live stock for one product. Always call this before telling a shopper " +
        "something is available, and before adding more than one — stock changes " +
        "constantly.",
      inputSchema: z.object(capabilities.checkStockSchema),
      execute: (input) => capabilities.checkStock(input),
    }),

    listCategories: tool({
      description:
        "All categories with how many products each holds. Use to answer 'what " +
        "kinds of things do you sell' or to find a valid category slug.",
      inputSchema: z.object({}),
      execute: () => capabilities.listCategories(),
    }),

    viewCart: tool({
      description:
        "The shopper's current cart: line items, quantities and subtotal. " +
        "Returns an empty cart if they have not started one.",
      inputSchema: z.object({}),
      execute: async () => capabilities.viewCart(await session.peek()),
    }),

    addToCart: tool({
      description:
        "Add a product to the shopper's cart. Quantity adds to whatever is " +
        "already there rather than replacing it. Confirm which product they mean " +
        "before calling this.",
      inputSchema: z.object(capabilities.addToCartSchema),
      execute: async (input) => {
        let token: string;
        try {
          token = await session.ensure();
        } catch {
          /*
           * A missing session is an internal condition a shopper cannot act on —
           * and whatever is returned here is read aloud by the model. The raw
           * message once reached a user verbatim; tool output is user-visible copy.
           */
          return {
            added: false as const,
            reason: "I could not reach your cart just now. Please try again.",
          };
        }

        const outcome = await capabilities.addToCart(token, input);
        if (outcome.added) session.invalidate(token);
        return outcome;
      },
    }),
  };
}

export type CommerceTools = ReturnType<typeof createCommerceTools>;
