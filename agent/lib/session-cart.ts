import { defineState } from "eve/context";
import * as capabilities from "@/lib/agent/capabilities";
import { cartTokenOf } from "./session";

/**
 * The session-owned cart, for callers that have no browser.
 *
 * The store has three session strategies, one per caller kind, all feeding
 * the same capability layer:
 *
 * - Browser: the httpOnly cookie, lifted into session auth by the channel.
 * - MCP client: an explicit token it minted and carries itself.
 * - Cookie-less eve sessions (Slack, scripts, evals): THIS — a token minted
 *   lazily on first write and kept in eve's durable session state, so a
 *   Slack thread's cart survives across turns, restarts and days exactly
 *   like the conversation it belongs to.
 *
 * The cookie always wins when present (the browser's cart is shared with the
 * storefront badge); state is the fallback identity, not a second cart.
 *
 * Everything here runs in ordinary tool context. Deliberately NOT in a
 * workflow: we verified empirically that `defineState` writes from inside a
 * `"use workflow"` step land in a discarded scope — the mint "succeeded" and
 * the session never saw the token. Session state belongs to ordinary-context
 * code (tools, hooks); workflows get plain data in and out.
 */
const sessionCart = defineState<{ token: string | null }>(
  "swag-store.session-cart",
  () => ({ token: null }),
);

export type ResolvedCart = { token: string; source: "cookie" | "state" };

type SessionLike = { session: Parameters<typeof cartTokenOf>[0] };

/**
 * Which cart does this session write to? Cookie first — the browser's cart,
 * shared with the storefront badge — then the session-owned cart, minted on
 * first need.
 */
export async function resolveCart(ctx: SessionLike): Promise<ResolvedCart> {
  const cookie = cartTokenOf(ctx.session);
  if (cookie) return { token: cookie, source: "cookie" };

  const existing = sessionCart.get().token;
  if (existing) return { token: existing, source: "state" };

  return { token: await replaceSessionCart(), source: "state" };
}

/** Read-only: cookie, then session state. For view_cart. */
export function currentCartToken(ctx: SessionLike): string | undefined {
  return cartTokenOf(ctx.session) ?? sessionCart.get().token ?? undefined;
}

/** Mint a fresh cart and make it the session's cart (also dead-cart recovery). */
export async function replaceSessionCart(): Promise<string> {
  const created = await capabilities.createCart();
  sessionCart.update(() => ({ token: created.cartToken }));
  return created.cartToken;
}
