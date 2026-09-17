import "server-only";
import { z } from "zod";
import { addItem } from "@/lib/cart-service";
import { commerce } from "@/lib/commerce";
import { getCategoryFacets, getProduct, listCatalogue } from "@/lib/data/catalogue";
import { getStock } from "@/lib/data/stock";
import { formatMoney } from "@/lib/money";

/**
 * The store's capabilities as plain functions and schemas.
 *
 * This is the single implementation behind both agent surfaces. The in-app
 * assistant wraps these as AI SDK tools with a cookie-backed session; the MCP
 * server registers them with an explicit cart token, because an external agent
 * has no cookies. Neither owns the logic.
 *
 * The alternative — defining tools once per surface — means the storefront's
 * assistant and a partner's agent can answer the same question differently, and
 * nothing would surface the divergence until someone noticed the answers
 * disagreed.
 *
 * Schemas are exported as plain field maps rather than `z.object(...)` because
 * that is what both consumers want: the AI SDK wraps them itself, and
 * `mcp-handler`'s `registerTool` takes the field map directly.
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
 * (the catalogue is 28 products — one cached read) and filters locally.
 */
export async function searchProducts(input: {
  query?: string;
  category?: string;
  maxPriceCents?: number;
  minPriceCents?: number;
  limit?: number;
}) {
  const limit = input.limit ?? 6;
  const priced = input.maxPriceCents !== undefined || input.minPriceCents !== undefined;

  const page = await listCatalogue({
    query: input.query,
    category: input.category,
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
  const product = await getProduct(input.idOrSlug);
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
  const stock = await getStock(input.idOrSlug);
  return {
    available: stock.quantity,
    inStock: stock.inStock,
    lowStock: stock.lowStock,
  };
}

export async function listCategories() {
  return { categories: await getCategoryFacets() };
}

// --------------------------------------------------------------------- cart

const EMPTY_CART = { itemCount: 0, subtotal: "$0.00", items: [] as const };

export async function viewCart(token: string | undefined) {
  if (!token) return EMPTY_CART;

  const cart = await commerce.getCart(token);
  if (!cart) return EMPTY_CART;

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
  | { added: false; reason: string };

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
  if (!result.ok) return { added: false, reason: result.error };

  return {
    added: true,
    itemCount: result.cart.totalItems,
    subtotal: formatMoney(result.cart.subtotal, "en-US"),
  };
}

/** MCP-only: external agents have no cookie, so they mint and carry a token. */
export async function createCart() {
  const cart = await commerce.createCart();
  return {
    cartToken: cart.token,
    note: "Pass this cartToken to view_cart and add_to_cart. It expires after 24h of inactivity.",
  };
}
