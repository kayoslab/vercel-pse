import { z } from "zod";
import { money } from "@/lib/money";
import { isNotFound } from "../errors";
import type { CommerceProvider } from "../provider";
import type {
  Cart,
  Category,
  Page,
  Product,
  ProductQuery,
  Promotion,
  StockLevel,
  StoreConfig,
} from "../types";
import { request } from "./http";
import {
  categorySchema,
  cartSchema,
  productListMetaSchema,
  productSchema,
  promotionSchema,
  stockSchema,
  storeConfigSchema,
  successEnvelope,
  successEnvelopeWithMeta,
  type WireCart,
  type WireProduct,
} from "./schemas";

/**
 * Maps the Vercel Swag Store API onto the CommerceProvider port.
 *
 * This file is the only place that knows the upstream's vocabulary — that
 * prices arrive as bare integers needing a currency attached, that cart lines
 * are called `items`, that an expired cart presents as a 404. Everything above
 * it speaks the domain.
 */

function toProduct(wire: WireProduct): Product {
  return {
    id: wire.id,
    slug: wire.slug,
    name: wire.name,
    description: wire.description,
    // The wire format splits amount and currency across two fields; the domain
    // keeps them together so a price can never be rendered without its unit.
    price: money(wire.price, wire.currency),
    category: wire.category,
    images: wire.images,
    tags: wire.tags,
    featured: wire.featured,
    createdAt: wire.createdAt,
  };
}

function toCart(wire: WireCart): Cart {
  return {
    token: wire.token,
    lines: wire.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      product: toProduct(item.product),
      lineTotal: money(item.lineTotal, wire.currency),
      addedAt: item.addedAt,
    })),
    totalItems: wire.totalItems,
    subtotal: money(wire.subtotal, wire.currency),
    createdAt: wire.createdAt,
    updatedAt: wire.updatedAt,
  };
}

export function createSwagStoreProvider(): CommerceProvider {
  return {
    async listProducts(query: ProductQuery = {}): Promise<Page<Product>> {
      const result = await request({
        path: "/products",
        schema: successEnvelopeWithMeta(
          z.array(productSchema),
          productListMetaSchema,
        ),
        query: {
          page: query.page,
          limit: query.limit,
          category: query.category,
          search: query.search,
          // The upstream expects the string "true"/"false", not a boolean.
          featured: query.featured === undefined ? undefined : String(query.featured),
        },
      });

      return {
        items: result.data.map(toProduct),
        pagination: result.meta.pagination,
      };
    },

    async getProduct(idOrSlug: string): Promise<Product | null> {
      try {
        const result = await request({
          path: `/products/${encodeURIComponent(idOrSlug)}`,
          schema: successEnvelope(productSchema),
        });
        return toProduct(result.data);
      } catch (error) {
        // A missing product is an expected outcome for a user-supplied slug,
        // not an exceptional one — let the caller render a 404 page.
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async getStock(idOrSlug: string): Promise<StockLevel> {
      const result = await request({
        path: `/products/${encodeURIComponent(idOrSlug)}/stock`,
        schema: successEnvelope(stockSchema),
      });
      return {
        productId: result.data.productId,
        quantity: result.data.stock,
        inStock: result.data.inStock,
        lowStock: result.data.lowStock,
      };
    },

    async listCategories(): Promise<readonly Category[]> {
      const result = await request({
        path: "/categories",
        schema: successEnvelope(z.array(categorySchema)),
      });
      return result.data;
    },

    async getActivePromotion(): Promise<Promotion | null> {
      try {
        const result = await request({
          path: "/promotions",
          schema: successEnvelope(promotionSchema),
        });
        return result.data;
      } catch (error) {
        // No running promotion is a normal state; the banner simply hides.
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async getStoreConfig(): Promise<StoreConfig> {
      const result = await request({
        path: "/store/config",
        schema: successEnvelope(storeConfigSchema),
      });
      return result.data;
    },

    async createCart(): Promise<Cart> {
      // The docs direct you to read the token from the `x-cart-token` response
      // header, but the body carries the full cart including the token — which
      // is both simpler and survives any proxy that strips custom headers.
      const result = await request({
        path: "/cart/create",
        method: "POST",
        schema: successEnvelope(cartSchema),
      });
      return toCart(result.data);
    },

    async getCart(token: string): Promise<Cart | null> {
      try {
        const result = await request({
          path: "/cart",
          schema: successEnvelope(cartSchema),
          cartToken: token,
        });
        return toCart(result.data);
      } catch (error) {
        // Cart tokens expire after 24h of inactivity and then present as a
        // 404. Returning null lets the caller mint a fresh cart silently
        // rather than showing the user an error they cannot act on.
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async addToCart(token, productId, quantity): Promise<Cart> {
      const result = await request({
        path: "/cart",
        method: "POST",
        schema: successEnvelope(cartSchema),
        cartToken: token,
        body: { productId, quantity },
      });
      return toCart(result.data);
    },

    async updateCartItem(token, productId, quantity): Promise<Cart> {
      const result = await request({
        path: `/cart/${encodeURIComponent(productId)}`,
        method: "PATCH",
        schema: successEnvelope(cartSchema),
        cartToken: token,
        body: { quantity },
      });
      return toCart(result.data);
    },

    async removeCartItem(token, productId): Promise<Cart> {
      const result = await request({
        path: `/cart/${encodeURIComponent(productId)}`,
        method: "DELETE",
        schema: successEnvelope(cartSchema),
        cartToken: token,
      });
      return toCart(result.data);
    },
  };
}
