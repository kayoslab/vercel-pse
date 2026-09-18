import { defineTool } from "eve/tools";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";

export default defineTool({
  description:
    "The currently running promotion (discount code, percentage, validity), " +
    "or none. Randomised per request by this store's backend, so call it at " +
    "the moment you need it — never reuse an earlier answer.",
  inputSchema: z.object({}),
  label: {
    start: () => "Checking the current promotion",
  },
  execute: () => capabilities.getPromotion(),
});
