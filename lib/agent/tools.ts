import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { addItem } from "@/lib/cart-service";
import { commerce } from "@/lib/commerce";
import { getCategoryFacets, getProduct, listCatalogue } from "@/lib/data/catalogue";
import { getStock } from "@/lib/data/stock";
import { formatMoney } from "@/lib/money";

/**
 * The store's capabilities, defined once.
 *
 * This is the centre of the whole agentic design: the same tools serve the in-app
 * assistant and the MCP endpoint that external agents connect to. Defining them
 * twice would guarantee they drift, and the drift would be invisible until an
 * external agent produced a different answer to the same question.
 *
 * What differs between callers is not the tools but the *session*. The in-app
 * assistant has a cookie; an MCP client has no cookies at all and must carry its
 * cart token explicitly. That difference is isolated in `CartSession` and
 * injected, so the tool bodies never know which kind of caller they serve.
 */
export type CartSession = {
  /** The caller's cart token, creating a cart if they have none yet. */
  ensure: () => Promise<string>;
  /** The caller's cart token if one already exists — never creates. */
  peek: () => Promise<string | undefined>;
  /** Invalidate cached reads of this cart. Server Actions and Route Handlers differ. */
  invalidate: (token: string) => void;
};

/**
 * Products are trimmed before they reach the model.
 *
 * Tool results are re-sent as input on every subsequent turn, so an untrimmed
 * catalogue payload is a cost that compounds across a conversation. Descriptions
 * are capped and only the first image is kept. The fields that survive are the
 * ones the UI needs to render a real product card and the model needs to
 * describe it.
 */
const SUMMARY_DESCRIPTION_LIMIT = 160;

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
    description:
      product.description.length > SUMMARY_DESCRIPTION_LIMIT
        ? `${product.description.slice(0, SUMMARY_DESCRIPTION_LIMIT).trimEnd()}…`
        : product.description,
  };
}

export function createCommerceTools(session: CartSession) {
  return {
    searchProducts: tool({
      description:
        "Search the store catalogue by free-text term and/or category. Use this " +
        "first for any question about what the store sells. Returns product " +
        "summaries including id, price and image.",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("Free-text term matched against name, description and tags."),
        category: z
          .string()
          .optional()
          .describe("Category slug. Call listCategories first if unsure."),
        limit: z.number().int().min(1).max(12).default(6),
      }),
      execute: async ({ query, category, limit }) => {
        const page = await listCatalogue({ query, category, limit });
        return {
          total: page.pagination.total,
          returned: page.items.length,
          products: page.items.map(summarise),
        };
      },
    }),

    getProductDetails: tool({
      description:
        "Full details for one product, by id or slug. Use after searchProducts " +
        "when the shopper asks about a specific item.",
      inputSchema: z.object({
        idOrSlug: z.string().describe("Product id (tshirt_001) or slug."),
      }),
      execute: async ({ idOrSlug }) => {
        const product = await getProduct(idOrSlug);
        if (!product) return { found: false as const };
        return {
          found: true as const,
          product: { ...summarise(product), description: product.description },
          tags: product.tags,
        };
      },
    }),

    checkStock: tool({
      description:
        "Live stock for one product. Always call this before telling a shopper " +
        "something is available, and before adding more than one of an item — " +
        "stock changes constantly.",
      inputSchema: z.object({ idOrSlug: z.string() }),
      execute: async ({ idOrSlug }) => {
        const stock = await getStock(idOrSlug);
        return {
          available: stock.quantity,
          inStock: stock.inStock,
          lowStock: stock.lowStock,
        };
      },
    }),

    listCategories: tool({
      description:
        "All categories with how many products each holds. Use to answer " +
        "'what kinds of things do you sell' or to find a valid category slug.",
      inputSchema: z.object({}),
      execute: async () => ({ categories: await getCategoryFacets() }),
    }),

    viewCart: tool({
      description:
        "The shopper's current cart: line items, quantities, line totals and " +
        "subtotal. Returns an empty cart if they have not started one.",
      inputSchema: z.object({}),
      execute: async () => {
        const token = await session.peek();
        if (!token) return { itemCount: 0, subtotal: "$0.00", items: [] };

        const cart = await commerce.getCart(token);
        if (!cart) return { itemCount: 0, subtotal: "$0.00", items: [] };

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
      },
    }),

    addToCart: tool({
      description:
        "Add a product to the shopper's cart. Quantity adds to whatever is " +
        "already there rather than replacing it. Confirm the product with the " +
        "shopper before calling this.",
      inputSchema: z.object({
        productId: z.string().describe("Product id, e.g. tshirt_001."),
        quantity: z.number().int().min(1).max(10).default(1),
      }),
      execute: async ({ productId, quantity }) => {
        let token: string;
        try {
          token = await session.ensure();
        } catch {
          /*
           * A missing session is an internal condition, not something a shopper
           * can act on — and whatever we return here is read aloud by the model.
           * The raw message ("the client must call ensureCartSession first") once
           * reached a user verbatim. Tool outputs are user-visible copy.
           */
          return {
            added: false as const,
            reason: "I could not reach your cart just now. Please try again.",
          };
        }

        const result = await addItem(token, productId, quantity);

        // The guard lives in the cart service, so the agent path cannot oversell
        // where the UI path would not. Failures are returned as data rather than
        // thrown: the model needs to read the reason and tell the shopper.
        if (!result.ok) return { added: false as const, reason: result.error };

        session.invalidate(token);
        return {
          added: true as const,
          itemCount: result.cart.totalItems,
          subtotal: formatMoney(result.cart.subtotal, "en-US"),
        };
      },
    }),
  };
}

export type CommerceTools = ReturnType<typeof createCommerceTools>;
