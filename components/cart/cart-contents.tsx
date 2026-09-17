"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { useCartBadge } from "@/components/cart/cart-badge-context";
import { Price } from "@/components/commerce/price";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { removeCartItem, updateCartItem, type CartActionResult } from "@/lib/actions/cart";
import type { Cart, CartLine } from "@/lib/commerce";
import { money, multiply } from "@/lib/money";

type CartContentsProps = {
  cart: Cart;
};

/**
 * A mutation the server has not confirmed yet. `opId` ties each in-flight
 * action to its overlay entry, so a failure only rolls back its own entry and
 * never one that a faster follow-up mutation has already replaced.
 */
type PendingOp =
  | { type: "remove"; opId: number }
  | { type: "setQuantity"; quantity: number; opId: number };

/** What a caller specifies; `run` stamps the opId. */
type PendingOpInput = { type: "remove" } | { type: "setQuantity"; quantity: number };

/**
 * Everything mutable about the cart, in one Client Component.
 *
 * ## Why this is NOT useOptimistic + startTransition
 *
 * It was, and the optimistic UI was flawless — while you stayed on the page.
 * React entangles overlapping transitions: an awaited Server Action inside
 * startTransition holds a pending transition open for its entire network
 * round trip, and any navigation started in that window cannot commit until
 * the action settles. Against this API's multi-second cart endpoints, on a
 * slow connection, that reads as the whole site freezing — measured: 83ms to
 * navigate away from the cart normally, 4,166ms with a removal in flight.
 *
 * So mutations here run as plain promises with an explicit pending overlay:
 *
 * - The overlay applies instantly (quantity moves, a removing line dims), so
 *   the immediate feedback survives the change.
 * - No transition is ever left pending, so navigation commits immediately.
 *   Next.js is built for this: its router prioritises navigations over
 *   in-flight actions and re-applies the action's revalidation afterwards.
 * - An overlay entry is not cleared when its action resolves — it is cleared
 *   when the server-rendered props catch up and agree with it. Clearing on
 *   resolve would flash the stale value for the frames between the action
 *   settling and the router applying the revalidated tree; this is the same
 *   override-until-truth-arrives pattern the header badge uses.
 *
 * Lines *and* the subtotal derive from one overlay so they always agree, and
 * a removing line stays visible — dimmed, with a spinner — rather than
 * vanishing while the server still owns it.
 */
export function CartContents({ cart }: CartContentsProps) {
  const [pending, setPending] = useState<ReadonlyMap<string, PendingOp>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const { begin: beginBadge, settle: settleBadge } = useCartBadge();
  const nextOpId = useRef(0);

  /*
   * Prune overlay entries the server has caught up with — during render, the
   * documented adjust-state-on-prop-change pattern. A `remove` entry is spent
   * when its line is gone from the props; a `setQuantity` entry when the
   * server line shows its quantity.
   */
  const spent = [...pending.entries()].filter(([productId, op]) => {
    const line = cart.lines.find((l) => l.productId === productId);
    if (op.type === "remove") return !line;
    return line?.quantity === op.quantity;
  });
  if (spent.length > 0) {
    setPending((m) => {
      const next = new Map(m);
      for (const [productId] of spent) next.delete(productId);
      return next;
    });
  }

  /** Server lines with the pending overlay applied. */
  const lines = cart.lines.map((line) => {
    const op = pending.get(line.productId);
    if (!op || op.type === "remove") {
      return { line, removing: op?.type === "remove" };
    }
    return {
      line: {
        ...line,
        quantity: op.quantity,
        lineTotal: multiply(line.product.price, op.quantity),
      } satisfies CartLine,
      removing: false,
    };
  });

  const active = lines.filter((l) => !l.removing);
  const currency = cart.subtotal.currency;
  const subtotal = money(
    active.reduce((sum, l) => sum + l.line.lineTotal.amount, 0),
    currency,
  );
  const itemCount = active.reduce((sum, l) => sum + l.line.quantity, 0);

  const run = (
    productId: string,
    op: PendingOpInput,
    countDelta: number,
    call: () => Promise<CartActionResult>,
  ) => {
    const opId = ++nextOpId.current;
    const entry: PendingOp =
      op.type === "remove"
        ? { type: "remove", opId }
        : { type: "setQuantity", quantity: op.quantity, opId };
    setError(null);
    // The badge shifts in the same breath as the lines, from the shared
    // context — see cart-badge-context.tsx for the settle-gap mechanics.
    beginBadge(countDelta);
    setPending((m) => new Map(m).set(productId, entry));

    const rollback = () =>
      setPending((m) => {
        // Only roll back the entry this op created; a newer op owns it now.
        if (m.get(productId)?.opId !== opId) return m;
        const next = new Map(m);
        next.delete(productId);
        return next;
      });

    call()
      .then((result) => {
        if (result.ok) {
          // The overlay stays until the revalidated tree confirms it; the
          // badge bridges with the authoritative count the action reported.
          settleBadge(countDelta, result.totalItems);
        } else {
          setError(result.error ?? "Something went wrong.");
          rollback();
          settleBadge(countDelta);
        }
      })
      .catch(() => {
        setError("Something went wrong — please try again.");
        rollback();
        settleBadge(countDelta);
      });
  };

  if (cart.lines.length === 0) {
    return (
      <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-base font-medium">Your cart is empty.</p>
        <p className="text-sm text-muted">Nothing added yet — have a look around.</p>
        <Link
          href="/products"
          className="relative mt-2 text-sm font-medium underline after:absolute after:inset-x-0 after:-inset-y-3"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <ul className="flex flex-1 flex-col divide-y divide-border rounded-lg border border-border">
        {lines.map(({ line, removing }) => (
          <li
            key={line.productId}
            className={`flex gap-4 p-4 transition-opacity ${removing ? "opacity-50" : ""}`}
          >
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

              {/* min-h matches the stepper row so the swap to "Removing…" cannot change the row's height. */}
              <div className="mt-1 flex min-h-9 flex-wrap items-center gap-3">
                {removing ? (
                  <span className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
                    <span
                      aria-hidden
                      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
                    />
                    Removing…
                  </span>
                ) : (
                  <>
                    <QuantityStepper
                      id={`qty-${line.productId}`}
                      label={line.product.name}
                      value={line.quantity}
                      onChange={(next) =>
                        run(line.productId, { type: "setQuantity", quantity: next },
                          next - line.quantity,
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
                        run(line.productId, { type: "remove" },
                          -line.quantity,
                          () => removeCartItem(line.productId))
                      }
                      className="text-sm text-muted underline transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      Remove
                    </button>
                  </>
                )}
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
