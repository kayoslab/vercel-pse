import { eveChannel } from "eve/channels/eve";
import { vercelOidc, type AuthFn } from "eve/channels/auth";

/**
 * Route auth for the store agent.
 *
 * The storefront's shoppers are anonymous by design — the same stance as the
 * public MCP endpoint: everything readable here is public on the storefront
 * anyway, and cart writes are protected by possession of an unguessable cart
 * token, not by identity. So the final entry deliberately admits everyone,
 * which is eve's explicit-opt-in for anonymous traffic (its default is to
 * fail closed).
 *
 * What the entry actually does is carry the session: requests are same-origin,
 * so the browser sends the storefront's cookies, and the httpOnly `cart_token`
 * — which client JavaScript can never read — is lifted here, at the one
 * server-side seam between the browser and the agent, into the session's auth
 * attributes. Tools read it from `ctx.session.auth`. The cart is created by a
 * Server Action when the assistant panel opens (a streamed route cannot set
 * cookies), so the token exists before the first message arrives.
 *
 * `vercelOidc()` runs first so eve's own internal callers (subagents, runtime)
 * keep their real identity instead of being folded into the shopper principal.
 */
const CART_COOKIE = "cart_token";

function storefrontShopper(): AuthFn<Request> {
  return (request) => {
    const cookies = request.headers.get("cookie") ?? "";
    const token = new RegExp(`(?:^|;\\s*)${CART_COOKIE}=([^;]+)`).exec(cookies)?.[1];

    const attributes: Record<string, string> = {};
    if (token) attributes.cartToken = token;

    return {
      authenticator: "storefront",
      principalId: token ? `shopper:${token}` : "shopper:anonymous",
      principalType: "user",
      attributes,
    };
  };
}

export default eveChannel({
  auth: [vercelOidc(), storefrontShopper()],
});
