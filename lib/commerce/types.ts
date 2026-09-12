import type { Money } from "@/lib/money";

/**
 * Domain types for the storefront.
 *
 * These deliberately do NOT mirror any single vendor's wire format. They
 * describe what a storefront needs — a catalogue, stock, a cart — so that
 * swapping the backing commerce service is an adapter change and nothing
 * in `app/` has to move. Vendor-shaped fields (envelopes, cents-as-integer,
 * `lineTotal` duplication) are normalised away at the adapter boundary.
 */

export type Product = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly price: Money;
  readonly category: string;
  readonly images: readonly string[];
  readonly tags: readonly string[];
  readonly featured: boolean;
  readonly createdAt: string;
};

/**
 * Stock is modelled as a snapshot rather than a property of Product on
 * purpose: it is the one genuinely real-time value in the domain, and keeping
 * it separate stops it being accidentally captured in a cached Product.
 */
export type StockLevel = {
  readonly productId: string;
  readonly quantity: number;
  readonly inStock: boolean;
  readonly lowStock: boolean;
};

export type Category = {
  readonly slug: string;
  readonly name: string;
  readonly productCount: number;
};

export type Promotion = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly discountPercent: number;
  readonly code: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly active: boolean;
};

export type CartLine = {
  readonly productId: string;
  readonly quantity: number;
  readonly product: Product;
  readonly lineTotal: Money;
  readonly addedAt: string;
};

export type Cart = {
  readonly token: string;
  readonly lines: readonly CartLine[];
  readonly totalItems: number;
  readonly subtotal: Money;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type StoreConfig = {
  readonly storeName: string;
  readonly currency: string;
  readonly seo: {
    readonly defaultTitle: string;
    readonly titleTemplate: string;
    readonly defaultDescription: string;
  };
  readonly socialLinks: Readonly<Record<string, string>>;
  readonly features: Readonly<Record<string, boolean>>;
};

export type Pagination = {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
};

export type Page<T> = {
  readonly items: readonly T[];
  readonly pagination: Pagination;
};

export type ProductQuery = {
  readonly page?: number;
  readonly limit?: number;
  readonly category?: string;
  readonly search?: string;
  readonly featured?: boolean;
};
