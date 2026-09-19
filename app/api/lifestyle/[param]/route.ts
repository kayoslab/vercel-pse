import { lifestyleShotsFlag } from "@/flags";
import { commerce } from "@/lib/commerce";
import { generateLifestyleShot } from "@/lib/lifestyle";

export const maxDuration = 60;

/**
 * GET /api/lifestyle/{id-or-slug} — an AI-generated lifestyle shot of the
 * product, as a PNG.
 *
 * The caching design IS the cost and abuse control: the response is
 * CDN-cached as immutable for a year, so generation runs once per product
 * per edge cache — a few cents to style the entire catalogue — and every
 * later shopper is served bytes from the CDN. The URL space is exactly the
 * catalogue (unknown products 404 before any model call, and the style is
 * derived from the product's category rather than read from the request),
 * so there is nothing for a hostile client to enumerate that costs money
 * beyond the catalogue itself.
 *
 * `no-store` on failure paths: an upstream hiccup must not become a cached
 * "this product has no shot" for a year.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ param: string }> },
) {
  const { param } = await params;

  // Defense in depth with the PDP's own gate: turning the flag off disables
  // the spend, not just the button. `no-store`, so a toggle takes effect on
  // the next request rather than being cached away.
  if (!(await lifestyleShotsFlag())) {
    return new Response("Feature disabled", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  const product = await commerce.getProduct(param).catch(() => null);
  if (!product) {
    return new Response("Unknown product", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  const shot = await generateLifestyleShot(product).catch(() => null);
  if (!shot) {
    return new Response("Generation unavailable", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }

  return new Response(new Uint8Array(shot.data), {
    status: 200,
    headers: {
      "content-type": shot.mediaType,
      "cache-control": "public, max-age=3600, s-maxage=31536000, immutable",
    },
  });
}
