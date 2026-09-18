/**
 * Reads the shopper's cart token from eve session auth.
 *
 * The token is lifted from the httpOnly storefront cookie by the channel's
 * auth walk (see ../channels/eve.ts) and travels as a session auth attribute —
 * the eve equivalent of the CartSession injection the AI SDK tools used. Tools
 * must not know how the token got here, only that the session carries it.
 *
 * `current` is the caller of the active turn and wins over `initiator`: a
 * shopper whose first message predates their cart still gets the fresh token
 * on every later turn, because the channel re-runs auth per request.
 */
type AuthAttributes = { readonly attributes: Readonly<Record<string, string | readonly string[]>> };

type SessionAuthLike = {
  readonly auth: {
    readonly current: AuthAttributes | null;
    readonly initiator: AuthAttributes | null;
  };
};

export function cartTokenOf(session: SessionAuthLike): string | undefined {
  for (const principal of [session.auth.current, session.auth.initiator]) {
    const value = principal?.attributes?.cartToken;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}
