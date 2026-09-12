import { z } from "zod";

/**
 * Wire-format schemas for the Vercel Swag Store API.
 *
 * These are validation, not just types. The upstream is a third-party service
 * we do not control, and its published OpenAPI document has already proven
 * unreliable — it declares a bypass header as mandatory that is not actually
 * enforced, and marks almost no properties as `required` even though every
 * response observed carries them all.
 *
 * So rather than trusting the document, these schemas require the fields that
 * were empirically verified to be present on every response. Marking them
 * optional "to be safe" would be the worse trade: it pushes a null check into
 * every call site to guard against a case that does not occur, and it would
 * let a genuinely malformed response flow silently into the UI — or worse,
 * into a `use cache` entry, where it would be served repeatedly.
 *
 * Validating at this boundary means bad data fails loudly, once, before it can
 * be cached.
 */

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  /** Minor units (cents). */
  price: z.number().int(),
  currency: z.string(),
  category: z.string(),
  images: z.array(z.string()),
  tags: z.array(z.string()),
  featured: z.boolean(),
  createdAt: z.string(),
});

export const stockSchema = z.object({
  productId: z.string(),
  stock: z.number().int(),
  inStock: z.boolean(),
  lowStock: z.boolean(),
});

export const categorySchema = z.object({
  slug: z.string(),
  name: z.string(),
  productCount: z.number().int(),
});

export const promotionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  discountPercent: z.number().int(),
  code: z.string(),
  validFrom: z.string(),
  validUntil: z.string(),
  active: z.boolean(),
});

export const cartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int(),
  addedAt: z.string(),
  product: productSchema,
  lineTotal: z.number().int(),
});

export const cartSchema = z.object({
  token: z.string(),
  items: z.array(cartItemSchema),
  totalItems: z.number().int(),
  subtotal: z.number().int(),
  currency: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const storeConfigSchema = z.object({
  storeName: z.string(),
  currency: z.string(),
  features: z.record(z.string(), z.boolean()),
  socialLinks: z.record(z.string(), z.string()),
  seo: z.object({
    defaultTitle: z.string(),
    titleTemplate: z.string(),
    defaultDescription: z.string(),
  }),
});

export const paginationSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const productListMetaSchema = z.object({
  pagination: paginationSchema,
});

/** Error envelope. `details` is deliberately `unknown` — its shape varies. */
export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

/** Success envelope, parameterised over the payload and optional meta. */
export function successEnvelope<TData extends z.ZodTypeAny>(data: TData) {
  return z.object({ success: z.literal(true), data });
}

export function successEnvelopeWithMeta<
  TData extends z.ZodTypeAny,
  TMeta extends z.ZodTypeAny,
>(data: TData, meta: TMeta) {
  return z.object({ success: z.literal(true), data, meta });
}

export type WireProduct = z.infer<typeof productSchema>;
export type WireStock = z.infer<typeof stockSchema>;
export type WireCategory = z.infer<typeof categorySchema>;
export type WirePromotion = z.infer<typeof promotionSchema>;
export type WireCart = z.infer<typeof cartSchema>;
export type WireStoreConfig = z.infer<typeof storeConfigSchema>;
export type WirePagination = z.infer<typeof paginationSchema>;
