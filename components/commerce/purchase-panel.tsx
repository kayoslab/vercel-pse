import { PurchaseControls } from "@/components/commerce/purchase-controls";
import { Button } from "@/components/ui/button";
import { StockIndicatorSkeleton } from "@/components/commerce/stock-indicator";
import { getStock } from "@/lib/data/stock";

type PurchasePanelProps = {
  productId: string;
};

/**
 * The product page's only dynamic hole, now narrowed to the availability line.
 *
 * The stock read is started here and handed to the client as a promise rather
 * than awaited. That puts the quantity stepper and the Add to Cart button in
 * the static shell, live from the first paint, while availability streams in
 * beside them. Against this API the stock read takes ~2.7s, and awaiting it
 * meant the most important control on the page was disabled for that long on
 * every visit.
 *
 * Enabling the button before stock is known is safe because the Server Action
 * re-reads stock on every add and rejects what it cannot fulfil; the page's
 * reading was only ever advisory. A click on a sold-out item gets the same
 * rejection copy it always did, and the controls adopt the guard's reading so
 * label, ceiling and message agree on one number.
 *
 * Everything else on the page — image, name, price, description — is cached and
 * ships in the prerendered shell.
 */
export function PurchasePanel({ productId }: PurchasePanelProps) {
  const stock = getStock(productId);

  return <PurchaseControls productId={productId} stockPromise={stock} />;
}

/**
 * The fallback for the rare case the panel itself cannot render — kept as the
 * real control row, disabled, so the dimensions never drift.
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
