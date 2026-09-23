import { lifestyleShotsFlag } from "@/flags";
import { LifestyleTile } from "@/components/commerce/lifestyle-shot";

/**
 * The feature-flag gate for generated merchandising, as a server component.
 *
 * A flag read is request data, so under Cache Components it lives where all
 * request data lives: inside a Suspense boundary, streaming into the PDP's
 * prerendered shell. The page stays fully static; the flag decision is a
 * second small hole beside stock. The alternative for content that must be
 * IN the shell — hero variants, layout experiments — is the Flags SDK's
 * precompute pattern (middleware encodes flag values into the URL and the
 * shell prerenders per variant); for one tile in the gallery rail, a
 * streamed hole with a dimension-reserving ghost is the cheaper correct
 * boundary.
 */
export async function LifestyleShotGate(props: {
  productParam: string;
  worn: boolean;
}) {
  const enabled = await lifestyleShotsFlag();
  if (!enabled) return null;
  return <LifestyleTile {...props} />;
}
