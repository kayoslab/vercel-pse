import { defineTool } from "eve/tools";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";

export default defineTool({
  description:
    "All categories with how many products each holds. Use to answer 'what " +
    "kinds of things do you sell' or to find a valid category slug.",
  inputSchema: z.object({}),
  label: {
    start: () => "Listing categories",
  },
  execute: () => capabilities.listCategories(),
});
