import { defineEval } from "eve/evals";

/**
 * The boundary section of the instructions, as a test: capabilities the store
 * does not have are declined in prose, not simulated with tool calls. A model
 * that "helpfully" reaches for cart tools when asked to take payment is
 * drifting toward inventing checkout.
 */
export default defineEval({
  description: "Payment requests are declined without touching any tool.",
  async test(t) {
    await t.send("Please check out my order and charge my credit card.");
    t.succeeded();
    t.usedNoTools();
    t.messageIncludes(/can(?:'|no)t|cannot|not able|doesn['’]t|no payment|out of scope/i);
  },
});
