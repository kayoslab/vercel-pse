"use client";

import { useState } from "react";
import { StockIndicator } from "@/components/commerce/stock-indicator";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { addToCart } from "@/lib/actions/cart";
import type { StockLevel } from "@/lib/commerce";

type PurchaseControlsProps = {
  productId: string;
  /** The stock reading streamed with the page. The server re-checks on add. */
  initialStock: StockLevel;
};

/**
 * Availability label, quantity selector and Add to Cart, driven by one stock
 * value in one client component.
 *
 * They started as separate components fed by the same server read, which was
 * fine until an add failed on stock: the error said "out of stock" while the
 * label above it still said "In stock" — stock randomises per request here, so
 * the page's snapshot and the guard's snapshot genuinely differ. A failed
 * action now returns the reading the guard rejected on, and this component
 * adopts it, so label, ceiling, button state and error message move together
 * to the same number.
 *
 * The submit is deliberately NOT wrapped in a transition. React entangles
 * overlapping transitions, so an awaited Server Action inside one holds every
 * subsequent navigation's commit hostage until the action settles — measured
 * at 4+ seconds on a slow connection against this API. A plain promise keeps
 * the pending spinner and keeps the router free; Next applies the action's
 * revalidation whenever the response lands, even mid-navigation.
 */
export function PurchaseControls({ productId, initialStock }: PurchaseControlsProps) {
  const [stock, setStock] = useState(initialStock);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /*
   * A fresh server reading (a revalidated stream after back-navigation) wins
   * over whatever this component adopted from an action error. Props are
   * compared by value and adopted during render — the documented adjust-state-
   * on-prop-change pattern — because <Activity> preserves this component's
   * state across navigations, so a stale adopted value would otherwise stick.
   */
  const [seenInitial, setSeenInitial] = useState(initialStock);
  if (
    initialStock.quantity !== seenInitial.quantity ||
    initialStock.inStock !== seenInitial.inStock ||
    initialStock.lowStock !== seenInitial.lowStock
  ) {
    setSeenInitial(initialStock);
    setStock(initialStock);
  }

  const disabled = !stock.inStock;

  const submit = () => {
    setPending(true);
    setError(null);
    addToCart(productId, quantity)
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
      <StockIndicator stock={stock} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper
            id="quantity"
            label="this product"
            value={quantity}
            onChange={setQuantity}
            max={stock.quantity}
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
