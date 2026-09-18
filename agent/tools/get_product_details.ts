import { defineTool } from "eve/tools";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";

export default defineTool({
  description:
    "Full details for one product, by id or slug. Use after search_products " +
    "when the shopper asks about a specific item.",
  inputSchema: z.object(capabilities.getProductDetailsSchema),
  label: {
    start: ({ idOrSlug }) => `Looking up ${idOrSlug}`,
  },
  execute: (input) => capabilities.getProductDetails(input),
});
