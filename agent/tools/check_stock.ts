import { defineTool } from "eve/tools";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";

export default defineTool({
  description:
    "Live stock for one product. Always call this before telling a shopper " +
    "something is available, and before adding more than one — stock changes " +
    "constantly.",
  inputSchema: z.object(capabilities.checkStockSchema),
  label: {
    start: ({ idOrSlug }) => `Checking stock for ${idOrSlug}`,
  },
  execute: (input) => capabilities.checkStock(input),
});
