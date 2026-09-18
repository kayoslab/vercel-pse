"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * The pending cart delta, shared between every surface that shows a count.
 *
 * The header badge is a server component fed by the cached per-token cart
 * read; the cart page's lines carry a pending overlay and move instantly.
 * Against an API where mutations take seconds, that split showed two
 * different counts during every adjustment — the page already at the new
 * quantity, the badge still on the old one. Storefronts avoid this with a
 * single client-side cart store that badge and page both read (Next.js
 * Commerce's CartProvider is the canonical example).
 *
 * This is the minimal version of that store: not the cart, only the *pending
 * delta* plus a short-lived override. The server count remains the source of
 * truth and keeps streaming from the cached read; a mutation applies its
 * delta when it starts, and on settling records the count the Server Action
 * itself reported. That report matters: the state update that releases the
 * delta commits a frame or two before the router applies the revalidated
 * tree, and in that gap the badge would fall back to the stale count. The
 * override bridges exactly that gap and clears as soon as the fresh
 * server-rendered count arrives. When nothing is in flight this context is
 * empty and invisible.
 */
type CartBadgeState = {
  /** Sum of in-flight mutations' item-count changes. */
  delta: number;
  /**
   * Authoritative count reported by the last settled mutation, bridging the
   * frames between the settling state update committing and the router
   * applying the revalidated tree. `null` when the server-rendered count is
   * current.
   */
  override: number | null;
  /** A mutation started: shift the pending delta. */
  begin: (by: number) => void;
  /**
   * A mutation settled: release its delta and, on success, record the count
   * the Server Action reported. Both land in one state update — releasing the
   * delta alone would let the badge fall back to the stale server-rendered
   * count for the frames before the revalidated tree arrives (the observed
   * 3 → 2 → 3 flicker).
   */
  settle: (by: number, serverCount?: number) => void;
  /** The server-rendered count caught up; the bridge is no longer needed. */
  clearOverride: () => void;
};

const CartBadgeContext = createContext<CartBadgeState | null>(null);

export function CartBadgeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ delta: number; override: number | null }>({
    delta: 0,
    override: null,
  });
  const begin = useCallback(
    (by: number) => setState((s) => ({ ...s, delta: s.delta + by })),
    [],
  );
  const settle = useCallback(
    (by: number, serverCount?: number) =>
      setState((s) => ({
        delta: s.delta - by,
        override: serverCount ?? s.override,
      })),
    [],
  );
  const clearOverride = useCallback(
    () => setState((s) => (s.override === null ? s : { ...s, override: null })),
    [],
  );
  const value = useMemo(
    () => ({ delta: state.delta, override: state.override, begin, settle, clearOverride }),
    [state, begin, settle, clearOverride],
  );

  return <CartBadgeContext.Provider value={value}>{children}</CartBadgeContext.Provider>;
}

export function useCartBadge(): CartBadgeState {
  const ctx = useContext(CartBadgeContext);
  if (!ctx) throw new Error("useCartBadge requires CartBadgeProvider in the tree.");
  return ctx;
}
