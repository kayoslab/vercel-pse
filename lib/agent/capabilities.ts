import { z } from "zod";
import { addItem, removeItem, setQuantity } from "@/lib/cart-service";
import { commerce } from "@/lib/commerce";
import { formatMoney, money } from "@/lib/money";

/**
 * The store's capabilities as plain functions and schemas.
 *
 * This is the single implementation behind every agent surface. The in-app
 * eve agent defines tools over these with a session-carried cart token; the
 * MCP server registers them with an explicit token, because an external agent
 * has no cookies. Neither owns the logic.
 *
 * The alternative — defining tools once per surface — means the storefront's
 * assistant and a partner's agent can answer the same question differently, and
 * nothing would surface the divergence until someone noticed the answers
 * disagreed.
 *
 * Two portability rules keep this consumable by the eve agent service, which
 * runs outside the Next.js runtime:
 *
 * - No `server-only` marker — it throws outside an RSC bundle. The
 *   client-import guard lives in the Next-facing layers.
 * - Reads go straight through the commerce provider, not through the
 *   `'use cache'` data layer — those directives belong to Next. The cache is a
 *   storefront-page concern; agent traffic is a handful of per-conversation
 *   calls against a fast catalogue API, and an uncached read can never be
 *   stale-wrong about stock.
 *
 * Schemas are exported as plain field maps rather than `z.object(...)` because
 * that is what the consumers want: eve tools and `mcp-handler`'s `registerTool`
 * both take the field map directly.
 */

/**
 * Products are trimmed before they reach any model. Tool results are re-sent as
 * input on every later turn, so an untrimmed payload is a cost that compounds
 * across a conversation.
 */
const DESCRIPTION_LIMIT = 160;

function truncate(text: string, limit = DESCRIPTION_LIMIT): string {
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

function summarise(product: {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  images: readonly string[];
  price: { amount: number; currency: string };
}) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    price: formatMoney(product.price, "en-US"),
    priceCents: product.price.amount,
    currency: product.price.currency,
    image: product.images[0],
    description: truncate(product.description),
  };
}

// ---------------------------------------------------------------- catalogue

export const searchProductsSchema = {
  query: z
    .string()
    .optional()
    .describe("Free-text term matched against product name, description and tags."),
  category: z
    .string()
    .optional()
    .describe("Category slug to narrow to. Call list_categories if unsure."),
  featured: z
    .boolean()
    .optional()
    .describe("Only the store's featured picks (the homepage grid, 6 products)."),
  maxPriceCents: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Only products costing at most this many cents (2500 = $25.00)."),
  minPriceCents: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Only products costing at least this many cents."),
  limit: z.number().int().min(1).max(12).optional().describe("Defaults to 6."),
};

/**
 * Price limits are enforced HERE, not left to the model. The UI renders every
 * product a tool result contains as a card, so a model that fetched unfiltered
 * results and described only the cheap ones would still show the expensive
 * cards — the constraint has to live in the data, not the prose. The upstream
 * API has no price parameter, so a priced search fetches the full match set
 * (a small catalogue — one bounded read) and filters locally.
 */
export async function searchProducts(input: {
  query?: string;
  category?: string;
  featured?: boolean;
  maxPriceCents?: number;
  minPriceCents?: number;
  limit?: number;
}) {
  const limit = input.limit ?? 6;
  const priced = input.maxPriceCents !== undefined || input.minPriceCents !== undefined;

  const page = await commerce.listProducts({
    search: input.query?.trim() || undefined,
    category: input.category || undefined,
    featured: input.featured,
    limit: priced ? 100 : limit,
  });

  const matches = page.items.filter(
    (p) =>
      (input.maxPriceCents === undefined || p.price.amount <= input.maxPriceCents) &&
      (input.minPriceCents === undefined || p.price.amount >= input.minPriceCents),
  );
  const items = matches.slice(0, limit);

  return {
    // With a price filter the honest total is the post-filter count; the
    // upstream pagination total would claim matches the shopper can't afford.
    total: priced ? matches.length : page.pagination.total,
    returned: items.length,
    products: items.map(summarise),
  };
}

export const getProductDetailsSchema = {
  idOrSlug: z.string().describe("Product id (e.g. tshirt_001) or slug."),
};

export async function getProductDetails(input: { idOrSlug: string }) {
  const product = await commerce.getProduct(input.idOrSlug);
  if (!product) return { found: false as const };
  return {
    found: true as const,
    product: { ...summarise(product), description: product.description },
    tags: product.tags,
  };
}

export const checkStockSchema = {
  idOrSlug: z.string().describe("Product id or slug."),
};

export async function checkStock(input: { idOrSlug: string }) {
  const stock = await commerce.getStock(input.idOrSlug);
  return {
    available: stock.quantity,
    inStock: stock.inStock,
    lowStock: stock.lowStock,
  };
}

export async function listCategories() {
  const categories = await commerce.listCategories();
  return {
    categories: categories
      .filter((c) => c.productCount > 0)
      .map((c) => ({ slug: c.slug, name: c.name, count: c.productCount })),
  };
}

/**
 * The running promotion, if any. Added after the scheduled digest agent
 * reported — correctly — that no tool exposed promotions: the banner was
 * UI-only. The API randomises the promotion per request, so this is a live
 * read like stock, never a cached claim.
 */
export async function getPromotion() {
  const promotion = await commerce.getActivePromotion();
  if (!promotion) return { active: false as const };
  return {
    active: true as const,
    title: promotion.title,
    description: promotion.description,
    discountPercent: promotion.discountPercent,
    code: promotion.code,
    validUntil: promotion.validUntil,
  };
}

// --------------------------------------------------------------------- cart

/**
 * The store's currency, memoised for the process: it comes from the backend's
 * own config (the same source the root metadata uses), so an empty cart never
 * hardcodes a symbol the backend didn't choose. One upstream read per
 * instance, not per empty-cart view.
 */
let currencyPromise: Promise<string> | undefined;
function storeCurrency(): Promise<string> {
  currencyPromise ??= commerce.getStoreConfig().then((config) => config.currency);
  return currencyPromise;
}

async function emptyCart() {
  return {
    itemCount: 0,
    subtotal: formatMoney(money(0, await storeCurrency()), "en-US"),
    items: [] as const,
  };
}

export async function viewCart(token: string | undefined) {
  if (!token) return emptyCart();

  const cart = await commerce.getCart(token);
  if (!cart) return emptyCart();

  return {
    itemCount: cart.totalItems,
    subtotal: formatMoney(cart.subtotal, "en-US"),
    items: cart.lines.map((line) => ({
      productId: line.productId,
      name: line.product.name,
      quantity: line.quantity,
      lineTotal: formatMoney(line.lineTotal, "en-US"),
      image: line.product.images[0],
    })),
  };
}

export const addToCartSchema = {
  productId: z.string().describe("Product id, e.g. tshirt_001."),
  quantity: z.number().int().min(1).max(10).optional().describe("Defaults to 1."),
};

export type AddToCartOutcome =
  | { added: true; itemCount: number; subtotal: string }
  /** `staleCart` marks the one failure whose recovery differs per caller (§cart session strategies). */
  | { added: false; reason: string; staleCart?: boolean };

/**
 * Adds to the cart, re-checking stock first via the shared cart service — so an
 * agent cannot oversell where the UI path would not. Failures are returned as
 * data rather than thrown: the model has to read the reason and relay it.
 */
export async function addToCart(
  token: string,
  input: { productId: string; quantity?: number },
): Promise<AddToCartOutcome> {
  const result = await addItem(token, input.productId, input.quantity ?? 1);
  if (!result.ok) {
    // A dead cart must not masquerade as a missing product: the generic
    // NOT_FOUND copy blames the item, and an agent relaying it tells the
    // shopper something in stock "is no longer available". Name the real
    // cause neutrally and flag it — the right *recovery advice* differs per
    // caller (browser: reload; session-owned: the tool retries itself; MCP:
    // create_cart again), so callers own that copy.
    if (result.cartMissing) {
      return {
        added: false,
        staleCart: true,
        reason: "The cart session has expired.",
      };
    }
    return { added: false, reason: result.error };
  }

  return {
    added: true,
    itemCount: result.cart.totalItems,
    subtotal: formatMoney(result.cart.subtotal, "en-US"),
  };
}

export const updateCartItemSchema = {
  productId: z.string().describe("Product id, e.g. tshirt_001."),
  quantity: z
    .number()
    .int()
    .min(0)
    .describe("New absolute quantity for the line; 0 removes it entirely."),
};

export const removeFromCartSchema = {
  productId: z.string().describe("Product id of the line to remove."),
};

export type CartChangeOutcome =
  | { changed: true; itemCount: number; subtotal: string }
  | { changed: false; reason: string; staleCart?: boolean };

/**
 * Quantity change / removal, added after a Slack shopper asked to remove an
 * item and the agent had to refuse: the storefront's steppers had these
 * operations all along (the shared cart service), but they were never exposed
 * as agent tools — and a Slack session's cart has no cart page to fall back
 * to. Same guards as the UI path, because it IS the UI path's service.
 */
export async function updateCartItem(
  token: string,
  input: { productId: string; quantity: number },
): Promise<CartChangeOutcome> {
  return toChangeOutcome(await setQuantity(token, input.productId, input.quantity));
}

export async function removeFromCart(
  token: string,
  input: { productId: string },
): Promise<CartChangeOutcome> {
  return toChangeOutcome(await removeItem(token, input.productId));
}

function toChangeOutcome(
  result: Awaited<ReturnType<typeof setQuantity>>,
): CartChangeOutcome {
  if (!result.ok) {
    if (result.cartMissing) {
      return { changed: false, staleCart: true, reason: "The cart session has expired." };
    }
    return { changed: false, reason: result.error };
  }
  return {
    changed: true,
    itemCount: result.cart.totalItems,
    subtotal: formatMoney(result.cart.subtotal, "en-US"),
  };
}

/** MCP-only: external agents have no cookie, so they mint and carry a token. */
export async function createCart() {
  const cart = await commerce.createCart();
  return {
    cartToken: cart.token,
    note: "Pass this cartToken to the cart tools (view_cart, add_to_cart, update_cart_item, remove_from_cart). It expires after a period of inactivity.",
  };
}
