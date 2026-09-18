import { defineEval } from "eve/evals";

/**
 * The panel's first suggestion chip, verbatim.
 *
 * Every canned prompt the UI offers is a commitment — it is the one input a
 * reviewer is guaranteed to try — so each chip lives here as a regression
 * test. This one asserts the retrieval contract: catalogue questions are
 * answered through search_products, and the search actually finds mugs.
 */
export default defineEval({
  description: "The mugs chip searches the catalogue and returns products.",
  async test(t) {
    await t.send("What mugs do you have?");
    t.succeeded();
    t.calledTool("search_products", {
      output: { returned: (n: unknown) => typeof n === "number" && n >= 1 },
    });
    t.noFailedActions();
  },
});
