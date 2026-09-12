import "server-only";
import type { CommerceProvider } from "./provider";
import { createSwagStoreProvider } from "./swag-store/adapter";

/**
 * The configured commerce backend.
 *
 * Swapping vendors is a one-line change here — write an adapter against
 * `CommerceProvider` and return it instead. Nothing in `app/` imports a
 * vendor module directly, so nothing in `app/` has to change.
 *
 * Kept as a module-level singleton because the adapter is stateless; there is
 * nothing per-request to construct, and the cart token travels as an argument.
 */
export const commerce: CommerceProvider = createSwagStoreProvider();

export type { CommerceProvider } from "./provider";
export * from "./types";
export { CommerceError, isCommerceError, isNotFound } from "./errors";
