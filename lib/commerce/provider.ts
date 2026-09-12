import type {
  Cart,
  Category,
  Page,
  Product,
  ProductQuery,
  Promotion,
  StockLevel,
  StoreConfig,
} from "./types";

/**
 * The port every commerce backend implements.
 *
 * This is the seam that makes the storefront reusable: `app/` depends only on
 * this interface, so pointing the same UI at commercetools, Shopify, or an
 * in-house service means writing one adapter, not editing pages.
 *
 * Two rules keep it honest:
 *
 * 1. **No request context.** Nothing here reads cookies or headers. The cart
 *    token is an explicit argument. Next.js forbids reading request APIs
 *    inside a `use cache` scope, so a provider that reached for `cookies()`
 *    could not be cached at all — passing the token in keeps every method
 *    cacheable by the caller.
 * 2. **No caching decisions.** The provider fetches; the call site decides
 *    what is cached and for how long. Caching policy lives in one place
 *    instead of being smeared through the data layer.
 */
export interface CommerceProvider {
  listProducts(query?: ProductQuery): Promise<Page<Product>>;

  /** Accepts an id or a slug. Resolves to `null` when no such product exists. */
  getProduct(idOrSlug: string): Promise<Product | null>;

  /** Real-time and uncacheable by nature — see `StockLevel`. */
  getStock(idOrSlug: string): Promise<StockLevel>;

  listCategories(): Promise<readonly Category[]>;

  /** Resolves to `null` when no promotion is currently running. */
  getActivePromotion(): Promise<Promotion | null>;

  getStoreConfig(): Promise<StoreConfig>;

  createCart(): Promise<Cart>;

  /**
   * Resolves to `null` when the token is unknown or expired, so callers can
   * transparently create a replacement rather than surfacing an error.
   */
  getCart(token: string): Promise<Cart | null>;

  addToCart(token: string, productId: string, quantity: number): Promise<Cart>;

  /** A quantity of 0 removes the line. */
  updateCartItem(token: string, productId: string, quantity: number): Promise<Cart>;

  removeCartItem(token: string, productId: string): Promise<Cart>;
}
