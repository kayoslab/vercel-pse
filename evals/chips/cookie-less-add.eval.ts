import { defineEval } from "eve/evals";

/**
 * The add chip, driven without a storefront cart.
 *
 * Eval sessions carry no cart cookie — the same state as a Slack thread or
 * any caller that bypasses the storefront. Since the session-owned cart
 * landed (agent/lib/session-cart.ts), the contract this pins changed from
 * "fails gracefully" to something stronger: **a cookie-less add mints the
 * session its own cart and succeeds — and if it fails, the only acceptable
 * reason is stock, never a missing cart.** An agent whose add fails on
 * plumbing, or that claims success with nowhere to add to, breaks the
 * contract either way.
 *
 * (The $60 hoodie also crosses the approval threshold, but t.send drives a
 * cheap product below it — approval parking is covered by the Playwright e2e,
 * which can answer the card.)
 */
export default defineEval({
  description:
    "A cookie-less add succeeds via a session-minted cart, or fails only on stock.",
  async test(t) {
    await t.send(
      "Add one Black Click Pen (product id pen_001) to my cart right now — no need to ask which one.",
    );
    t.succeeded();
    t.calledTool("add_to_cart", {
      output: (o: unknown) => {
        const out = o as { added?: unknown; reason?: unknown };
        if (out.added === true) return true;
        return typeof out.reason === "string" && /stock/i.test(out.reason);
      },
    });
    t.messageIncludes(/cart|stock/i);
  },
});
