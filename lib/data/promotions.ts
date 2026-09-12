import "server-only";
import { commerce } from "@/lib/commerce";
import type { Promotion } from "@/lib/commerce";

/**
 * The promotional banner — dynamic, and degrading to nothing on failure.
 *
 * Uncached because the brief specifies a dynamic banner and the upstream
 * randomises its response per request. It streams into the homepage behind a
 * Suspense boundary.
 *
 * Worth being able to defend on both sides: for a real retailer this is the
 * one call here I would cache, with a short `minutes` profile. Not for load —
 * it is one request — but for coherence. An endpoint that returns a different
 * promotion each time makes the banner change as the shopper navigates, which
 * reads as a bug and undermines the offer. The brief asks for dynamic, so this
 * is dynamic; the trade-off is a deliberate choice rather than an oversight.
 *
 * A failed promotion must never take down the homepage. A missing banner costs
 * a marketing impression; an error page costs the whole session. So this
 * resolves to `null` on any failure and the banner simply does not render.
 * This is the one place that swallows errors, and it does so because the data
 * is genuinely optional — catalogue and cart failures must stay loud.
 */
export async function getActivePromotion(): Promise<Promotion | null> {
  try {
    return await commerce.getActivePromotion();
  } catch (error) {
    console.error("Promotion unavailable, rendering without banner", error);
    return null;
  }
}
