import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { commerce } from "@/lib/commerce";
import { isFrameworkControlFlow } from "@/lib/framework";
import type { Promotion } from "@/lib/commerce";

/**
 * The promotional banner — briefly cached, degrading to nothing on failure.
 *
 * Cached for a minute, shared across instances. Two reasons, in order of
 * weight. Coherence: the upstream returns a different promotion per request,
 * so an uncached banner changes as the shopper navigates, which reads as a bug
 * and undermines the offer. Speed: this endpoint answers in two to three
 * seconds, and as the homepage's only dynamic hole it was the whole gap
 * between the 0.4s shell and the 3.3s page. One minute is short enough that a
 * campaign change is live before anyone notices and long enough that nobody
 * but the first visitor each minute pays the upstream.
 *
 * A life under five minutes is excluded from the prerender, so the banner is
 * still a streamed hole in the static shell; it just streams from the remote
 * cache rather than from the upstream. The brief asks for a banner from
 * GET /promotions; it gets one.
 *
 * A failed promotion must never take down the homepage. A missing banner costs
 * a marketing impression; an error page costs the whole session. So this
 * resolves to `null` on any failure and the banner simply does not render.
 * This is the one place that swallows errors, and it does so because the data
 * is genuinely optional — catalogue and cart failures must stay loud. The
 * `null` is cached too, for the same minute: a down endpoint should not be
 * retried on every page view.
 */
export async function getActivePromotion(): Promise<Promotion | null> {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });
  cacheTag(cacheTags.promotions);

  try {
    return await commerce.getActivePromotion();
  } catch (error) {
    // Never swallow framework control flow. A bare catch here would silently
    // absorb a redirect, a notFound, or the abort that ends a prerender — and
    // during a build that last one fires once per prerendered page, filling the
    // log with failures that would mask a real promotions outage.
    if (isFrameworkControlFlow(error)) throw error;

    console.error("Promotion unavailable, rendering without banner", error);
    return null;
  }
}
