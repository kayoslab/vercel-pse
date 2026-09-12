"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
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

  // A stock value of 0 still needs a sane upper bound for the input.
  const ceiling = Math.max(1, maxQuantity);
  const clamp = (n: number) => Math.min(ceiling, Math.max(1, n));

  const submit = () => {
    startTransition(async () => {
      setResult(await addToCart(productId, quantity));
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-md border border-border">
          <Stepper
            label="Decrease quantity"
            onClick={() => setQuantity((q) => clamp(q - 1))}
            disabled={disabled || pending || quantity <= 1}
          >
            −
          </Stepper>
          <label className="sr-only" htmlFor="quantity">
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={ceiling}
            value={quantity}
            disabled={disabled || pending}
            onChange={(e) => setQuantity(clamp(Number(e.target.value) || 1))}
            /*
              Fixed width so the control cannot resize as the digits change,
              and the native spinner is hidden in favour of the explicit
              buttons — a 16px spinner is a poor touch target.
            */
            className="w-12 border-x border-border bg-transparent py-2 text-center text-sm tabular-nums outline-none [appearance:textfield] focus-visible:bg-surface [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <Stepper
            label="Increase quantity"
            onClick={() => setQuantity((q) => clamp(q + 1))}
            disabled={disabled || pending || quantity >= ceiling}
          >
            +
          </Stepper>
        </div>

        {/*
          The label stays exactly "Add to Cart" in every state. Pending is
          conveyed with aria-busy and the disabled styling instead of swapping
          the text, which would both reflow the button and change the accessible
          name mid-interaction.
        */}
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

type StepperProps = {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
};

function Stepper({ label, onClick, disabled, children }: StepperProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="size-9 shrink-0 text-base text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}
