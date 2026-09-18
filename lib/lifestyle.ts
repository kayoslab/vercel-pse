import { generateText } from "ai";
import type { Product } from "@/lib/commerce";

/**
 * Generated lifestyle photography for a product — the product's own image
 * plus a styled scene, produced by an image-editing model through the
 * Vercel AI Gateway. Auth is OIDC, like every other model call in this
 * project: adding image generation added no API key.
 *
 * The style is chosen per category, not per request: wearables get a
 * fictional model wearing the piece, bags get a carry shot, everything else
 * gets a desk scene. One style per product keeps the cacheable surface — and
 * therefore the total generation cost — bounded by the catalogue size.
 *
 * The prompt says "fictional" deliberately and twice. Generating the
 * likeness of any real person is out of bounds — a policy the models
 * enforce and this store agrees with.
 */
const WORN = new Set(["t-shirts", "hoodies", "socks", "hats"]);
const CARRIED = new Set(["bags"]);

function stylePrompt(product: Product): string {
  const keepDesign =
    "Keep the product's design exactly as shown: black, with the solid white " +
    "upward-pointing triangle mark unchanged in shape and placement.";

  if (WORN.has(product.category)) {
    return (
      `Generate a photorealistic lifestyle product photo based on this exact ${product.name}: ` +
      "a fictional adult model (not any real person, not resembling anyone specific) " +
      "wearing it in a bright, minimal photo studio with soft natural light. " +
      keepDesign
    );
  }
  if (CARRIED.has(product.category)) {
    return (
      `Generate a photorealistic lifestyle product photo based on this exact ${product.name}: ` +
      "a fictional adult model (not any real person) carrying it over the shoulder " +
      "on a bright city street, shallow depth of field. " +
      keepDesign
    );
  }
  return (
    `Generate a photorealistic lifestyle product photo based on this exact ${product.name}: ` +
    "placed in a bright, minimal workspace scene — light wooden desk, soft window " +
    "light, a laptop and a small plant out of focus in the background. " +
    keepDesign
  );
}

export type LifestyleShot = { data: Uint8Array; mediaType: string };

/**
 * One generation, ~10s and a few cents. Callers own caching; the route in
 * front of this lets the CDN hold the result effectively forever, so the
 * cost is paid once per product, not per shopper.
 */
export async function generateLifestyleShot(product: Product): Promise<LifestyleShot | null> {
  const image = product.images[0];
  if (!image) return null;

  const result = await generateText({
    model: "google/gemini-2.5-flash-image",
    messages: [
      {
        role: "user",
        content: [
          { type: "file", mediaType: "image/png", data: new URL(image) },
          { type: "text", text: stylePrompt(product) },
        ],
      },
    ],
  });

  const file = result.files?.find((f) => f.mediaType?.startsWith("image/"));
  if (!file) return null;
  return { data: file.uint8Array, mediaType: file.mediaType };
}
