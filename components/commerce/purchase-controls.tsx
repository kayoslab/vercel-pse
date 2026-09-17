"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { addToCart } from "@/lib/actions/cart";

type AddToCartFormProps = {
  productId: string;
  /** Current stock. The selector clamps to this; the server re-checks anyway. */
  maxQuantity: number;
  disabled: boolean;
};

export function AddToCartForm({ productId, maxQuantity, disabled }: AddToCartFormProps) {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      setError(null);
      const result = await addToCart(productId, quantity);
      if (!result.ok) setError(result.error);
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
  );
}
