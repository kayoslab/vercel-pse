import { defineEval } from "eve/evals";

/**
 * The add chip, driven without a storefront cart.
 *
 * Eval sessions carry no cart cookie — exactly the state of any caller that
 * bypasses the storefront — so this pins the degradation contract: the add
 * tool reports failure as data, and the agent relays it instead of claiming
 * success. An agent that says "added!" with nowhere to add to is the trust
 * failure this store's whole tool-output-is-copy discipline exists to prevent.
 */
export default defineEval({
  description: "An add without a cart fails as data and is relayed, not papered over.",
  async test(t) {
    await t.send(
      "Add one Black Pullover Hoodie (product id hoodie_001) to my cart right now — no need to ask which one.",
    );
    t.succeeded();
    t.calledTool("add_to_cart", {
      output: { added: false },
    });
    t.messageIncludes(/cart/i);
  },
});
