"use client";

import Link from "next/link";
import { useCartBadge } from "@/components/cart/cart-badge-context";

/**
 * The badge itself, client-side so it can add the shared pending delta to the
 * server-streamed count. `count` is the cached per-token truth; `delta` covers
 * the seconds a mutation is in flight, so the badge agrees with the cart
 * page's optimistic lines instead of trailing them. Clamped at zero: a remove
 * settling against an already-refreshed count must not flash a negative.
 */
export function CartBadgeLink({ count }: { count: number }) {
  const { delta } = useCartBadge();
  const shown = Math.max(0, count + delta);

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
