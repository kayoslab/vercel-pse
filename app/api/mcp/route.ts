/*
 * No `export const runtime` here: Cache Components rejects that segment config
 * outright ("not compatible with nextConfig.cacheComponents") and the build
 * fails. It is also unnecessary — Cache Components does not support the Edge
 * runtime, so Node is already the only option.
 */
export const maxDuration = 60;

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import * as capabilities from "@/lib/agent/capabilities";

/**
 * MCP server for the Vercel Swag Store.
 *
 * Streamable HTTP endpoint: /api/mcp
 *
 * This is the second consumer of `lib/agent/capabilities.ts` — the same functions
 * the in-app assistant calls. That is the whole point of the design: the store's
 * capabilities are defined once and exposed to a human UI, an in-app agent, and
 * any third-party agent, so all three necessarily agree. A partner's agent and
 * our own assistant cannot give different answers to the same question.
 *
 * ## Sessions
 *
 * An MCP client has no cookies, so it cannot use the browser's cart. Instead it
 * calls `create_cart` once, receives an opaque token, and passes that token to
 * the cart tools. The token is the credential — the same anonymous token the
 * storefront keeps in an httpOnly cookie.
 *
 * ## Why this endpoint is unauthenticated
 *
 * A deliberate choice, not an omission:
 *
 * - Everything readable here is already public on the storefront. `search_products`
 *   exposes nothing a visitor cannot see by loading /products.
 * - Cart writes are scoped by a token the caller must already hold. Without one
 *   there is no cart to modify, and tokens are unguessable UUIDs.
 * - Requiring a bearer token would make the endpoint undemonstrable: the value of
 *   an MCP server is that someone can point their own agent at it.
 *
 * What would change for a real store: broker identity in front of it — Vercel
 * Connect or an OAuth resource server (`withMcpAuth` is available in this package
 * for exactly that) — so cart operations are tied to an authenticated shopper
 * rather than to possession of a token, and so per-client rate limits exist.
 */
const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_products",
      {
        title: "Search products",
        description:
          "Search the Vercel Swag Store catalogue by free-text term and/or " +
          "category. Returns product summaries with id, price and image URL. " +
          "Use the returned id with add_to_cart.",
        inputSchema: capabilities.searchProductsSchema,
      },
      async (input) => asText(await capabilities.searchProducts(input)),
    );

    server.registerTool(
      "get_product",
      {
        title: "Get product details",
        description:
          "Full details for a single product, by id (tshirt_001) or slug " +
          "(black-crewneck-t-shirt).",
        inputSchema: capabilities.getProductDetailsSchema,
      },
      async (input) => asText(await capabilities.getProductDetails(input)),
    );

    server.registerTool(
      "check_stock",
      {
        title: "Check stock",
        description:
          "Live stock level for one product. Stock changes on every request, so " +
          "check it immediately before relying on it.",
        inputSchema: capabilities.checkStockSchema,
      },
      async (input) => asText(await capabilities.checkStock(input)),
    );

    server.registerTool(
      "list_categories",
      {
        title: "List categories",
        description: "Every product category with the number of products in it.",
        inputSchema: {},
      },
      async () => asText(await capabilities.listCategories()),
    );

    server.registerTool(
      "get_promotion",
      {
        title: "Current promotion",
        description:
          "The currently running promotion (code, percentage, validity), or " +
          "none. Randomised per request — call at the moment of need.",
        inputSchema: {},
      },
      async () => asText(await capabilities.getPromotion()),
    );

    server.registerTool(
      "create_cart",
      {
        title: "Create a cart",
        description:
          "Create an empty cart and return its token. Call this once, then pass " +
          "the token to view_cart and add_to_cart. Needed because an MCP client " +
          "has no browser session of its own.",
        inputSchema: {},
      },
      async () => asText(await capabilities.createCart()),
    );

    server.registerTool(
      "view_cart",
      {
        title: "View cart",
        description: "Contents, line totals and subtotal for a cart token.",
        inputSchema: {
          cartToken: z.string().describe("Token returned by create_cart."),
        },
      },
      async ({ cartToken }) => asText(await capabilities.viewCart(cartToken)),
    );

    server.registerTool(
      "add_to_cart",
      {
        title: "Add to cart",
        description:
          "Add a product to a cart. Quantity adds to what is already there " +
          "rather than replacing it. Stock is validated server-side, so this can " +
          "legitimately fail — read the returned reason.",
        inputSchema: {
          cartToken: z.string().describe("Token returned by create_cart."),
          ...capabilities.addToCartSchema,
        },
      },
      async ({ cartToken, ...input }) =>
        asText(await capabilities.addToCart(cartToken, input)),
    );

    server.registerTool(
      "update_cart_item",
      {
        title: "Update cart item",
        description:
          "Set the absolute quantity of a product in a cart; 0 removes it. " +
          "Stock is re-checked for increases, so this can legitimately fail.",
        inputSchema: {
          cartToken: z.string().describe("Token returned by create_cart."),
          ...capabilities.updateCartItemSchema,
        },
      },
      async ({ cartToken, ...input }) =>
        asText(await capabilities.updateCartItem(cartToken, input)),
    );

    server.registerTool(
      "remove_from_cart",
      {
        title: "Remove from cart",
        description: "Remove a product line from a cart entirely.",
        inputSchema: {
          cartToken: z.string().describe("Token returned by create_cart."),
          ...capabilities.removeFromCartSchema,
        },
      },
      async ({ cartToken, ...input }) =>
        asText(await capabilities.removeFromCart(cartToken, input)),
    );
  },
  {
    serverInfo: { name: "vercel-swag-store", version: "1.0.0" },
    instructions:
      "Tools for browsing and buying from the Vercel Swag Store. Search or list " +
      "categories to find products, check stock before promising availability, " +
      "and call create_cart once before using the cart tools.",
  },
);

/** MCP tool results are content blocks; JSON is the honest encoding for data. */
function asText(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/**
 * GET is two different callers with two correct answers.
 *
 * An MCP client GETs this endpoint (Accept: text/event-stream) to open the
 * spec's optional server→client SSE stream; this server does not offer one,
 * and the Streamable HTTP spec mandates 405 for that — which is what the
 * delegated handler returns, and why 405s on this route in the logs are a
 * client probing the optional stream, not an error.
 *
 * A human clicking the endpoint link in the README (Accept: text/html) is
 * not an MCP client, and a bare 405 would read as broken. They get a page
 * that says what this is and how to connect an agent to it.
 */
export async function GET(request: Request) {
  if (request.headers.get("accept")?.includes("text/html")) {
    return new Response(EXPLAINER_HTML, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return handler(request);
}

const EXPLAINER_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Swag Store MCP</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #000; color: #fff;
         font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
  main { max-width: 40rem; padding: 3rem 1.5rem; text-align: center; }
  svg { width: 72px; height: auto; margin-bottom: 1.5rem; }
  h1 { font-size: 1.5rem; margin: 0 0 .75rem; letter-spacing: -0.02em; }
  p { color: rgba(255,255,255,.7); line-height: 1.6; margin: 0 0 1.25rem; }
  pre { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15); border-radius: 8px;
        padding: 1rem; text-align: left; overflow-x: auto; font-size: .85rem; line-height: 1.5; }
  a { color: #fff; }
</style>
</head>
<body>
<main>
  <svg viewBox="0 0 400 300" role="presentation"><path d="M200 70 269.3 190H130.7z" fill="#fff"/></svg>
  <h1>Vercel Swag Store — MCP endpoint</h1>
  <p>This is a Model Context Protocol server (Streamable HTTP). It speaks JSON-RPC over POST —
     there is nothing further to see in a browser. Point an agent at it instead:</p>
  <pre>claude mcp add --transport http swag-store \
  https://vercel-swag-store-lac.vercel.app/api/mcp</pre>
  <p>Ten tools: search, product details, live stock, categories, the running promotion,
     and an anonymous token-scoped cart with add, update and remove. <a href="/">Back to the store</a></p>
</main>
</body>
</html>
`;

export { handler as POST, handler as DELETE };
