import { defineTool } from "eve/tools";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";
import { cartTokenOf } from "../lib/session";

export default defineTool({
  description:
    "The shopper's current cart: line items, quantities and subtotal. " +
    "Returns an empty cart if they have not started one.",
  inputSchema: z.object({}),
  label: {
    start: () => "Reading your cart",
  },
  execute: (_input, ctx) => capabilities.viewCart(cartTokenOf(ctx.session)),
});
