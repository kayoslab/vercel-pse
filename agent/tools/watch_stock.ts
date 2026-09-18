import { defineWorkflowTool } from "eve/tools";
import { sleep } from "workflow";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";

/**
 * The durable-workflow demo this API was made for: stock randomises on every
 * request and genuinely hits zero, so "tell me when it's back" is a real
 * request the storefront could never answer — a chat request/response cannot
 * outlive its connection.
 *
 * This runs as a background workflow: the tool returns a task receipt
 * immediately and the conversation moves on. The body then alternates a
 * stock check (a step — a real side-effecting read) with a durable sleep that
 * holds no compute. Close the panel, navigate away, redeploy the storefront —
 * the run persists, and when stock appears the completed task wakes the agent,
 * which reports back into the same durable session.
 *
 * Bounded, deliberately: a watch that never gives up is a leak, not a
 * feature. ~10 minutes of checks is far beyond what the demo needs and short
 * enough that an abandoned session cannot accumulate orphan pollers.
 */
const CHECK_INTERVAL = "30s";
const MAX_CHECKS = 20;

export default defineWorkflowTool({
  description:
    "Watch an out-of-stock product and report back in this conversation the " +
    "moment it is available again. Returns immediately with a pending task; " +
    "the result arrives later as a notification. Use when a shopper wants " +
    "something that is currently out of stock.",
  inputSchema: z.object({
    productId: z.string().describe("Product id, e.g. tshirt_001."),
    productName: z
      .string()
      .describe("Human-readable product name, echoed back in the result."),
  }),
  execution: "background",
  label: {
    start: ({ productName }) => `Watching ${productName} for restock`,
  },
  async execute({ productId, productName }) {
    "use workflow";
    for (let attempt = 0; attempt < MAX_CHECKS; attempt++) {
      const stock = await readStock(productId);
      if (stock.inStock) {
        return {
          backInStock: true as const,
          productId,
          productName,
          available: stock.available,
        };
      }
      await sleep(CHECK_INTERVAL);
    }
    return {
      backInStock: false as const,
      productId,
      productName,
      note: "Stopped watching after 10 minutes without a restock.",
    };
  },
});

async function readStock(productId: string) {
  "use step";
  return capabilities.checkStock({ idOrSlug: productId });
}
