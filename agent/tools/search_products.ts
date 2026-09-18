import { defineTool } from "eve/tools";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";

/**
 * Thin wrapper: the implementation and the schema live in the shared
 * capability layer, exactly as they do for the MCP server. Eve's contribution
 * here is the durable runtime around the call, not the call itself.
 */
export default defineTool({
  description:
    "Search the store catalogue by free-text term, category, featured flag " +
    "and/or price range. Use this first for any question about what the store " +
    "sells; pass featured=true for the store's curated picks. When the " +
    "shopper names a budget, pass it as maxPriceCents/minPriceCents — the " +
    "results are shown to them directly, so the search itself must respect " +
    "the limit.",
  inputSchema: z.object(capabilities.searchProductsSchema),
  label: {
    start: ({ query, category }) =>
      `Searching the catalogue${query ? ` for “${query}”` : ""}${category ? ` in ${category}` : ""}`,
  },
  execute: (input) => capabilities.searchProducts(input),
});
