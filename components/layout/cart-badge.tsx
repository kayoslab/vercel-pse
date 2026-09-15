"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCartBadge } from "@/components/cart/cart-badge-context";

/**
 * The badge itself, client-side so it can combine three inputs that are
 * fresh at different moments: the server-streamed `count` (the cached
 * per-token truth), the settled-action `override` (authoritative the instant
 * a mutation completes, before the revalidated tree arrives), and the
 * pending `delta` for mutations still in flight. Clamped at zero: a remove
 * settling against an already-refreshed count must not flash a negative.
 */
export function CartBadgeLink({ count }: { count: number }) {
  const { delta, override, clearOverride } = useCartBadge();

  /*
   * Once a *new* server-rendered count arrives, the override has served its
   * purpose — and holding it longer would mask counts changed by other
   * surfaces (an assistant add refreshing the router, another tab).
   */
  const lastCount = useRef(count);
  useEffect(() => {
    if (count !== lastCount.current) {
      lastCount.current = count;
      clearOverride();
    }
  }, [count, clearOverride]);

  const shown = Math.max(0, (override ?? count) + delta);

  return (
    <Link
      href="/cart"
      aria-label={shown > 0 ? `Cart, ${shown} item${shown === 1 ? "" : "s"}` : "Cart, empty"}
      className="relative inline-flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <CartIcon />
      {shown > 0 && (
        /*
          Absolutely positioned so the badge appearing cannot resize the button
          and reflow the header row.
        */
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-foreground">
          {shown > 99 ? "99+" : shown}
        </span>
      )}
    </Link>
  );
}

export function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
    >
      <path d="M2.5 3h2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.8a1.6 1.6 0 0 0 1.6-1.3L20.5 7H5" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </svg>
  );
}
