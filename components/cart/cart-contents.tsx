"use client";

import Image from "next/image";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Price } from "@/components/commerce/price";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { removeCartItem, updateCartItem } from "@/lib/actions/cart";
import type { Cart, CartLine } from "@/lib/commerce";
import { money, multiply } from "@/lib/money";

type CartContentsProps = {
  cart: Cart;
};

type Action =
  | { type: "setQuantity"; productId: string; quantity: number }
  | { type: "remove"; productId: string };

/**
 * Applies a pending change to the lines so the UI can move before the server
 * confirms. Line totals and the subtotal are recomputed from the same data the
 * API would use — unit price × quantity — so the optimistic figures match what
 * comes back rather than approximating it.
 */
function reduce(lines: readonly CartLine[], action: Action): readonly CartLine[] {
  switch (action.type) {
    case "remove":
      return lines.filter((l) => l.productId !== action.productId);
    case "setQuantity":
      return lines
        .map((l) =>
          l.productId === action.productId
            ? {
                ...l,
                quantity: action.quantity,
                lineTotal: multiply(l.product.price, action.quantity),
              }
            : l,
        )
        .filter((l) => l.quantity > 0);
  }
}

/**
 * Everything mutable about the cart, in one Client Component.
 *
 * Lines *and* the subtotal live together on purpose: cart mutations take
 * 1–4 seconds against this API, and a quantity that moves instantly while the
 * total below it lags for three seconds looks broken. Keeping them in one
 * optimistic state means they always agree.
 *
 * Optimism is safe here in a way it was not on the product page. Decreasing and
 * removing cannot be rejected, and an increase that exceeds stock is corrected
 * by the server re-render along with an explicit message — whereas an
 * optimistic *add* could claim an item was in the cart when it never made it.
 */
export function CartContents({ cart }: CartContentsProps) {
  const [lines, applyOptimistic] = useOptimistic(cart.lines, reduce);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const currency = cart.subtotal.currency;
  const subtotal = money(
    lines.reduce((sum, l) => sum + l.lineTotal.amount, 0),
    currency,
  );
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  const run = (action: Action, call: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      applyOptimistic(action);
      setError(null);
      const result = await call();
      // A failure needs no rollback: the optimistic value is discarded when the
      // Server Action's re-render supplies the real cart. All that is missing is
      // telling the shopper why nothing changed.
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  };

  if (lines.length === 0) {
    return (
      <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-base font-medium">Your cart is empty.</p>
        <p className="text-sm text-muted">Nothing added yet — have a look around.</p>
        <Link href="/products" className="mt-2 text-sm font-medium underline">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <ul className="flex flex-1 flex-col divide-y divide-border rounded-lg border border-border">
        {lines.map((line) => (
          <li key={line.productId} className="flex gap-4 p-4">
            <Link
              href={`/products/${line.product.slug}`}
              className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-surface sm:size-24"
            >
              <Image
                src={line.product.images[0]}
                alt={line.product.name}
                fill
                sizes="96px"
                className="object-cover"
              />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link
                  href={`/products/${line.product.slug}`}
                  className="text-sm font-medium hover:underline"
                >
                  {line.product.name}
                </Link>
                {/* Line total is the figure shoppers reconcile against. */}
                <Price value={line.lineTotal} className="text-sm font-medium tabular-nums" />
              </div>

              <Price value={line.product.price} className="text-xs text-muted" />

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <QuantityStepper
                  id={`qty-${line.productId}`}
                  label={line.product.name}
                  value={line.quantity}
                  onChange={(next) =>
                    run({ type: "setQuantity", productId: line.productId, quantity: next },
                      () => updateCartItem(line.productId, next))
                  }
                  /*
                    Stock is not read per line here: it is recomputed upstream on
                    every request, so any ceiling shown would differ each load.
                    The server validates the increase instead.
                  */
                  max={99}
                />
                <button
                  type="button"
                  onClick={() =>
                    run({ type: "remove", productId: line.productId },
                      () => removeCartItem(line.productId))
                  }
                  className="text-sm text-muted underline transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="flex w-full flex-col gap-4 rounded-lg border border-border bg-surface p-5 lg:w-80 lg:shrink-0">
        <h2 className="text-base font-semibold">Order summary</h2>

        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">
              {itemCount === 1 ? "1 item" : `${itemCount} items`}
            </dt>
            <dd className="tabular-nums">
              <Price value={subtotal} />
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">
              <Price value={subtotal} />
            </dd>
          </div>
        </dl>

        {/* Reserved so an error appearing cannot push the button under the cursor. */}
        <p aria-live="polite" className="min-h-5 text-sm text-red-600 dark:text-red-400">
          {error ?? ""}
        </p>

        {/*
          Deliberately disabled, and labelled. Payment is outside the scope of
          this exercise, and a button that looks live but silently does nothing
          is worse than one that states its boundary.
        */}
        <Button type="button" size="lg" disabled className="w-full">
          Checkout
        </Button>
        <p className="text-xs text-muted">
          Checkout is out of scope for this exercise — no payment is processed.
        </p>
      </aside>
    </div>
  );
}
