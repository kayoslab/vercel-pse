/**
 * Next.js signals control flow with thrown errors, not just return values:
 * `redirect()`, `notFound()`, and the abort that ends a prerender all surface
 * as exceptions carrying a `digest` property.
 *
 * That makes a broad `catch` in a Server Component genuinely dangerous — it
 * will happily swallow a redirect or a 404 and turn it into a silent no-op.
 * Any catch block that degrades gracefully must re-throw these first.
 */
export function isFrameworkControlFlow(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error;
}

/**
 * True when a request was cancelled from outside — a caller's abort signal, or
 * Next.js tearing down a prerender or a render the client navigated away from.
 *
 * Distinct from our own deadline, which raises `TimeoutError` and *is* worth
 * retrying. There is nothing left to retry for a cancellation: the work that
 * wanted the result is already gone.
 */
export function isCancellation(error: unknown): boolean {
  return (
    isFrameworkControlFlow(error) ||
    (error instanceof Error && error.name === "AbortError")
  );
}
