import "server-only";
import { generateText, Output } from "ai";
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
  limit: z.number().int().min(1).max(12).optional().describe("Defaults to 6."),
};

export async function searchProducts(input: {
  query?: string;
  category?: string;
  limit?: number;
}) {
  const page = await listCatalogue({
    query: input.query,
    category: input.category,
    limit: input.limit ?? 6,
  });
  return {
    total: page.pagination.total,
    returned: page.items.length,
    products: page.items.map(summarise),
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

// ------------------------------------------------------- natural language

/**
 * Same model as the in-app assistant, through the same AI Gateway/OIDC path —
 * no provider key exists anywhere in this project.
 */
const INTENT_MODEL = "anthropic/claude-opus-5";

export type SearchIntent = {
  readonly query?: string;
  readonly category?: string;
};

/**
 * Maps a shopper's description to the store's structured search parameters —
 * the capability layer's third consumer, after the assistant and MCP.
 *
 * The point is what it reuses: `query` is the same field, with the same
 * `describe()`, that types the `searchProducts` tool, and the category enum is
 * built from the live (cached) category list, so the model can only ever emit
 * a slug that actually exists. The parser cannot drift from the tools because
 * they are the same schema.
 *
 * Constraints the store cannot filter by (price, size, colour-as-a-filter) are
 * deliberately folded into or dropped from the free-text query rather than
 * pretended at: a parameter the backend ignores would make the parse look
 * smarter than the search it feeds.
 */
export async function parseSearchIntent(utterance: string): Promise<SearchIntent> {
  const categories = await getCategoryFacets();
  const slugs = categories.map((c) => c.slug);

  const schema = z.object({
    query: searchProductsSchema.query,
    category:
      slugs.length > 0
        ? z
            .enum(slugs as [string, ...string[]])
            .optional()
            .describe("Only when the request clearly maps to one product category.")
        : z.string().optional(),
  });

  /*
   * The upstream search is a strict AND-match over the words: every word must
   * literally occur in a product's name, description or tags, so "coffee"
   * matches nothing (the catalogue never uses the word) while "insulated"
   * matches two products. Verified empirically — which is why the prompt
   * demands concrete product vocabulary and prefers the category filter,
   * rather than letting the model write a descriptive phrase that ANDs
   * itself to zero results.
   */
  const result = await generateText({
    model: INTENT_MODEL,
    output: Output.object({ schema }),
    system:
      "Convert a shopper's description into search parameters for a merchandise " +
      "store selling apparel, drinkware, desk gear, bags, stationery and " +
      "accessories.\n\n" +
      "The search engine requires EVERY word of the query to literally appear " +
      "in a product's name or tags, so descriptive phrases find nothing. " +
      "Prefer selecting a category alone. Add a query only when the shopper " +
      "names a concrete product type, material or feature — a single word like " +
      "'hoodie', 'insulated', 'ceramic', 'notebook' — never intent words like " +
      "'gift', 'coffee' or 'warm', and never more than two words. Give both " +
      "fields only when they agree — the query must name something that " +
      "belongs inside the chosen category; when unsure, return only one of " +
      "the two. Ignore constraints the search cannot express, such as price " +
      "or sizing.\n\n" +
      "Categories (slug — name):\n" +
      categories.map((c) => `${c.slug} — ${c.name}`).join("\n"),
    prompt: utterance,
    providerOptions: {
      gateway: { tags: ["feature:nl-search", "app:swag-store"] },
    },
  });

  return result.output;
}
