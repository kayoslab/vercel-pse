import { PurchaseControls } from "@/components/commerce/purchase-controls";
import { Button } from "@/components/ui/button";
import { StockIndicatorSkeleton } from "@/components/commerce/stock-indicator";
import { getStock } from "@/lib/data/stock";

type PurchasePanelProps = {
  productId: string;
};

/**
 * The product page's only dynamic hole.
 *
 * Availability, the quantity ceiling and the button's disabled state are all
 * derived from one stock reading, so they stream as a single unit. Splitting
 * them would mean two boundaries resolving independently and a window in which
 * the button is enabled for an item the indicator already says is sold out.
 * The reading is handed to one client component (PurchaseControls) so a failed
 * add can move all three to the fresher number the guard rejected on.
 *
 * Everything else on the page — image, name, price, description — is cached and
 * ships in the prerendered shell.
 */
export async function PurchasePanel({ productId }: PurchasePanelProps) {
  const stock = await getStock(productId);

  return <PurchaseControls productId={productId} initialStock={stock} />;
}

/**
 * The fallback renders the *real* control row, disabled.
 *
 * The obvious version of this is a pair of grey boxes, and it would be worse.
 * On a storefront the buy button is the most important element on the page, and
 * a product page that briefly shows no way to purchase reads as broken. So the
 * shell carries a genuine, correctly-sized "Add to Cart" button in a disabled
 * state, with "Checking availability…" above it explaining why — and it is
 * disabled rather than enabled because failing closed is the only safe default
 * before stock is known.
 *
 * It reuses `Button` so the dimensions cannot drift from the interactive
 * version, and ships no JavaScript of its own.
 */
export function PurchasePanelSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <StockIndicatorSkeleton />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Matches the stepper's border box: two 36px buttons either side of a 48px field. */}
          <div
            aria-hidden
            className="flex items-center gap-1 rounded-md border border-border text-muted"
          >
            <span className="flex size-9 items-center justify-center opacity-40">−</span>
            <span className="w-12 border-x border-border py-2 text-center text-sm tabular-nums">
              1
            </span>
            <span className="flex size-9 items-center justify-center opacity-40">+</span>
          </div>
          <Button type="button" size="lg" disabled className="flex-1 sm:flex-none">
            Add to Cart
          </Button>
        </div>
        <div className="min-h-5" />
      </div>
    </div>
  );
}
