import { defineTool } from "eve/tools";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";
import { currentCartToken } from "../lib/session-cart";

export default defineTool({
  description:
    "The shopper's current cart: line items, quantities and subtotal. " +
    "Returns an empty cart if they have not started one.",
  inputSchema: z.object({}),
  label: {
    start: () => "Reading your cart",
  },
  // Cookie first (the browser's cart, shared with the storefront badge),
  // then the session-owned cart a cookie-less caller may have minted.
  execute: (_input, ctx) => capabilities.viewCart(currentCartToken(ctx)),
});
