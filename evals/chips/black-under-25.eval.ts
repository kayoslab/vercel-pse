import { defineEval } from "eve/evals";

/**
 * The chip that once returned $40 products.
 *
 * The bug's lesson (log 2026-09-17): the UI renders every product a tool
 * result contains, so a budget must travel in the tool call — the model
 * filtering in prose cannot remove cards it already fetched. This eval pins
 * both halves of the fix: the call carries the constraint, and the returned
 * data respects it.
 */
export default defineEval({
  description: "A budget in the prompt becomes a price constraint in the tool call.",
  async test(t) {
    await t.send("Something black under $25");
    t.succeeded();
    t.calledTool("search_products", {
      input: {
        maxPriceCents: (v: unknown) => typeof v === "number" && v <= 2500,
      },
      output: {
        products: (items: unknown) =>
          Array.isArray(items) &&
          items.every(
            (p) =>
              typeof p === "object" &&
              p !== null &&
              typeof (p as { priceCents?: unknown }).priceCents === "number" &&
              (p as { priceCents: number }).priceCents <= 2500,
          ),
      },
    });
  },
});
