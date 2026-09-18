import { defineEval } from "eve/evals";

/**
 * The first rule of the instructions — every factual catalogue claim goes
 * through a tool — tested with a product the store does not sell. The agent
 * must look before saying no: a "no" from the model's imagination is as
 * untrustworthy as a yes.
 */
export default defineEval({
  description: "Unknown products are checked against the catalogue, not guessed at.",
  async test(t) {
    await t.send("Do you sell surfboards?");
    t.succeeded();
    t.calledTool("search_products");
  },
});
