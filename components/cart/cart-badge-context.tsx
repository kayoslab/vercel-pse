"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * The pending cart delta, shared between every surface that shows a count.
 *
 * The header badge is a server component fed by the cached per-token cart
 * read; the cart page's lines are optimistic and move instantly. Against an
 * API where mutations take seconds, that split showed two different counts
 * during every adjustment — the page already at the new quantity, the badge
 * still on the old one. Storefronts avoid this with a single client-side cart
 * store that badge and page both read (Next.js Commerce's CartProvider is the
 * canonical example).
 *
 * This is the minimal version of that store: not the cart, only the *pending
 * delta*. The server count remains the source of truth and keeps streaming
 * from the cached read; a mutation applies its delta when it starts and
 * releases it when the action settles — which is also the moment the action's
 * re-render delivers the fresh server count. Badge and page therefore move in
 * the same frame, and when nothing is in flight this context is zero and
 * invisible.
 */
type CartBadgeState = {
  /** Sum of in-flight mutations' item-count changes. */
  delta: number;
  /** Shift the pending delta; call again with the negation when settled. */
  adjust: (by: number) => void;
};

const CartBadgeContext = createContext<CartBadgeState | null>(null);

export function CartBadgeProvider({ children }: { children: React.ReactNode }) {
  const [delta, setDelta] = useState(0);
  const adjust = useCallback((by: number) => setDelta((d) => d + by), []);
  const value = useMemo(() => ({ delta, adjust }), [delta, adjust]);

  return <CartBadgeContext.Provider value={value}>{children}</CartBadgeContext.Provider>;
}

export function useCartBadge(): CartBadgeState {
  const ctx = useContext(CartBadgeContext);
  if (!ctx) throw new Error("useCartBadge requires CartBadgeProvider in the tree.");
  return ctx;
}
