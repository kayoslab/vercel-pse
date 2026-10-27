"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { StockIndicator, StockIndicatorSkeleton } from "@/components/commerce/stock-indicator";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { addToCart } from "@/lib/actions/cart";
import { ensureCartSession } from "@/lib/actions/session";
import type { StockLevel } from "@/lib/commerce";

type PurchaseControlsProps = {
  productId: string;
  /** The stock reading, streamed with the page. The server re-checks on add. */
  stockPromise: Promise<StockLevel>;
};

/** Ceiling for the stepper before stock is known; the server guard is the real one. */
const UNKNOWN_STOCK_CEILING = 99;

/**
 * Quantity selector and Add to Cart, live from the first paint; availability
 * streams in beside them and all three move together once it has.
 *
 * The stock promise is read by a child inside its own Suspense boundary, so
 * only the availability line waits for the upstream. The button does not: the
 * Server Action re-reads stock on every add, so an early click on a sold-out
 * item is rejected with the same copy as before, and the controls adopt the
 * guard's reading — the same number the rejection was based on — so label,
 * ceiling and message agree.
 *
 * The cart session is created in the background as soon as the controls mount.
 * The first add used to pay for cart creation (~2.5s) inside the click; now it
 * happens while the shopper is still reading. The add awaits that promise so
 * a fast click cannot race the cookie and end up in a second cart.
 *
 * The submit is deliberately NOT wrapped in a transition. React entangles
 * overlapping transitions, so an awaited Server Action inside one holds every
 * subsequent navigation's commit hostage until the action settles — measured
 * at 4+ seconds on a slow connection against this API. A plain promise keeps
 * the pending spinner and keeps the router free; Next applies the action's
 * revalidation whenever the response lands, even mid-navigation.
 */
export function PurchaseControls({ productId, stockPromise }: PurchaseControlsProps) {
  // `null` means not yet known. Set by the streamed reading or by a rejection.
  const [stock, setStock] = useState<StockLevel | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const session = useRef<Promise<void> | null>(null);
  useEffect(() => {
    session.current = ensureCartSession().catch(() => undefined);
  }, []);

  const ceiling = stock?.quantity ?? UNKNOWN_STOCK_CEILING;
  const disabled = stock !== null && !stock.inStock;

  const submit = () => {
    setPending(true);
    setError(null);
    (session.current ?? Promise.resolve())
      .then(() => addToCart(productId, quantity))
      .then((result) => {
        if (result.ok) return;
        setError(result.error);
        if (result.stock) {
          setStock(result.stock);
          setQuantity((q) => Math.max(1, Math.min(q, result.stock ? result.stock.quantity : q)));
        }
      })
      .catch(() => setError("Something went wrong — please try again."))
      .finally(() => setPending(false));
  };

  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<StockIndicatorSkeleton />}>
        <StreamedStock promise={stockPromise} override={stock} onResolved={setStock} />
      </Suspense>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper
            id="quantity"
            label="this product"
            value={quantity}
            onChange={setQuantity}
            max={ceiling}
            disabled={disabled || pending}
          />

          {/*
            Progress is a spinner inside the button; success is the header badge
            updating — which it does the moment the action settles, so no prose
            restates it. The spinner sits absolutely in the button's padding so
            its appearance cannot move the label or resize the button, and the
            add stays deliberately non-optimistic: stock is recomputed upstream
            per request, so an add genuinely can fail, and a claimed success
            that revokes itself costs more trust than a moment of waiting.
          */}
          <Button
            type="button"
            size="lg"
            onClick={submit}
            disabled={disabled || pending}
            aria-busy={pending}
            className="relative flex-1 sm:flex-none"
          >
            Add to Cart
            {pending && (
              <span
                aria-hidden
                className="absolute right-1.5 size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
              />
            )}
          </Button>
        </div>

        {/*
          Errors only, in a height-reserved line so their appearance cannot push
          the page under a cursor that has just clicked. Failures are common by
          design here — the API randomises stock per request — so they must be
          told, not swallowed.
        */}
        <p aria-live="polite" className="min-h-5 text-sm text-red-600 dark:text-red-400">
          {error ?? ""}
        </p>
      </div>
    </div>
  );
}

type StreamedStockProps = {
  promise: Promise<StockLevel>;
  /** A reading adopted from a rejected add wins over the streamed one. */
  override: StockLevel | null;
  onResolved: (stock: StockLevel) => void;
};

/**
 * Reads the streamed stock and lifts it to the parent once it arrives.
 *
 * A fresh server reading (a revalidated stream after back-navigation) is a new
 * promise, so this re-suspends briefly and lifts the new value — which is what
 * keeps the controls honest when <Activity> preserves them across navigations.
 */
function StreamedStock({ promise, override, onResolved }: StreamedStockProps) {
  const resolved = use(promise);
  useEffect(() => {
    onResolved(resolved);
  }, [resolved, onResolved]);

  return <StockIndicator stock={override ?? resolved} />;
}
