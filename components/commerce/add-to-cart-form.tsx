"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { addToCart, type CartActionResult } from "@/lib/actions/cart";

type AddToCartFormProps = {
  productId: string;
  /** Current stock. The selector clamps to this; the server re-checks anyway. */
  maxQuantity: number;
  disabled: boolean;
};

export function AddToCartForm({ productId, maxQuantity, disabled }: AddToCartFormProps) {
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<CartActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      setResult(await addToCart(productId, quantity));
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper
          id="quantity"
          label="this product"
          value={quantity}
          onChange={setQuantity}
          max={maxQuantity}
          disabled={disabled || pending}
        />

        <Button
          type="button"
          size="lg"
          onClick={submit}
          disabled={disabled || pending}
          aria-busy={pending}
          className="flex-1 sm:flex-none"
        >
          Add to Cart
        </Button>
      </div>

      {/*
        Reserved height. The status line appears after an action, directly below
        the button — letting it push the page would move content under a cursor
        that has just clicked.

        While pending it says "Adding…" rather than optimistically claiming
        success. The add genuinely can fail: stock is recomputed upstream on
        every request, so an item that showed as available a moment ago may be
        gone by the time the action runs — which happened repeatedly in testing.
        An optimistic "Added to cart" that then revoked itself would be worse
        than waiting, because a shopper who believes an item is in their cart
        and finds it missing at checkout stops trusting the store.
      */}
      <p
        aria-live="polite"
        className={`min-h-5 text-sm ${
          !pending && result && !result.ok
            ? "text-red-600 dark:text-red-400"
            : "text-muted"
        }`}
      >
        {pending
          ? "Adding…"
          : result?.ok
            ? `Added to cart — ${result.totalItems} item${result.totalItems === 1 ? "" : "s"} total.`
            : (result?.error ?? "")}
      </p>
    </div>
  );
}
