import type { StockLevel } from "@/lib/commerce";

type StockIndicatorProps = {
  stock: StockLevel;
};

/**
 * Three states, deliberately. "Only N left" is not decoration — scarcity is
 * real information when stock is genuinely low, and a shopper who sees it
 * before adding to the cart is not surprised at checkout.
 *
 * Presentational only, so it can be reused wherever availability is shown.
 */
export function StockIndicator({ stock }: StockIndicatorProps) {
  if (!stock.inStock) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-muted">
        <Dot className="bg-muted" />
        Out of stock
      </p>
    );
  }

  if (stock.lowStock) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Dot className="bg-amber-500" />
        Only {stock.quantity} left
      </p>
    );
  }

  return (
    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
      <Dot className="bg-emerald-500" />
      In stock
    </p>
  );
}

/** Colour is paired with text in every state, never used as the sole signal. */
function Dot({ className }: { className: string }) {
  return <span aria-hidden className={`size-2 shrink-0 rounded-full ${className}`} />;
}

/**
 * Reserves the exact height of a single status line. Availability sits directly
 * above the quantity selector and the Add to Cart button, so a change in its
 * height would move the primary action just as the shopper reaches for it.
 */
export function StockIndicatorSkeleton() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
      <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-skeleton" />
      Checking availability…
    </p>
  );
}
