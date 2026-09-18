import type { z } from "zod";
import { env } from "@/lib/env";
import { isCancellation } from "@/lib/framework";
import { CommerceError, type CommerceErrorCode } from "../errors";
import { errorEnvelopeSchema } from "./schemas";

/**
 * HTTP transport for the Swag Store API.
 *
 * Everything vendor-specific about talking to this service lives here and
 * nowhere else: the base URL, the bypass header, the success/error envelope,
 * and the mapping from upstream error codes to domain ones.
 *
 * Runtime-neutral: the eve agent service imports this chain too, and the
 * `server-only` marker throws outside an RSC bundle. The client-import guard
 * lives in the Next-facing layers above (`lib/data/*`); the token itself only
 * ever flows through `env()`, and the deployed client chunks are verified
 * token-free as part of the release checks.
 */

/** Upstream error codes we recognise; anything else becomes UPSTREAM_ERROR. */
const ERROR_CODE_MAP: Record<string, CommerceErrorCode> = {
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_SERVER_ERROR: "UPSTREAM_ERROR",
};

/**
 * Resilience policy.
 *
 * A storefront's availability is bounded by how it behaves when its commerce
 * backend is slow or flapping, not by how it behaves when everything is
 * healthy. Two rules:
 *
 * 1. **Every request has a deadline.** An upstream that hangs must not hold a
 *    server function open until the platform kills it. Under Partial
 *    Prerendering the static shell has already reached the user, so a timeout
 *    degrades one streamed hole rather than the page.
 * 2. **Only idempotent requests are retried.** Catalogue reads are safe to
 *    repeat. Cart writes are not: `POST /cart` *adds* quantity rather than
 *    setting it, so a retry after a response that was actually delivered would
 *    silently double what the customer ordered. Losing a write is recoverable
 *    by the user; duplicating one is not.
 */
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 120;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

type RequestOptions<TSchema extends z.ZodTypeAny> = {
  /** Path relative to the API base, e.g. `/products`. */
  path: string;
  /** Schema for the whole envelope — validated before anything is returned. */
  schema: TSchema;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Cart token, sent as `x-cart-token` when present. */
  cartToken?: string;
};

export async function request<TSchema extends z.ZodTypeAny>(
  options: RequestOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  const { SWAG_API_BASE_URL, SWAG_API_BYPASS_TOKEN } = env();

  const url = new URL(`${SWAG_API_BASE_URL}${options.path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    // Documented as mandatory. Enforcement is currently off upstream, but
    // sending it regardless means the app keeps working if it is switched on.
    "x-vercel-protection-bypass": SWAG_API_BYPASS_TOKEN,
  };
  if (options.cartToken) headers["x-cart-token"] = options.cartToken;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const method = options.method ?? "GET";
  const idempotent = method === "GET";
  const attempts = idempotent ? MAX_ATTEMPTS : 1;

  let response: Response | undefined;
  let lastCause: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await backoff(attempt);

    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: withDeadline(),
      });
    } catch (cause) {
      // A cancellation is not a failure and must not be retried: Next.js
      // aborts in-flight fetches when a prerender finishes or a render is
      // discarded, and retrying burns upstream requests for a result nobody
      // is waiting for. Re-thrown untouched so React still sees its own
      // control-flow error rather than a CommerceError wrapping it.
      if (isCancellation(cause)) throw cause;

      // Genuine transport failure: DNS, connection reset, or our own deadline.
      lastCause = cause;
      response = undefined;
      continue;
    }

    if (!RETRYABLE_STATUSES.has(response.status)) break;
    lastCause = undefined;
  }

  if (!response) {
    throw new CommerceError(
      "UPSTREAM_ERROR",
      `Request to ${options.path} failed after ${attempts} attempt(s)`,
      { cause: lastCause },
    );
  }

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw toCommerceError(payload, response.status, options.path);
  }

  const parsed = options.schema.safeParse(payload);
  if (!parsed.success) {
    // A 200 whose body does not match the contract is an upstream bug. Fail
    // here so it cannot be written into a cache entry and served repeatedly.
    throw new CommerceError(
      "INVALID_RESPONSE",
      `Unexpected response shape from ${options.path}`,
      { status: response.status, details: parsed.error.issues },
    );
  }

  return parsed.data;
}

function toCommerceError(
  payload: unknown,
  status: number,
  path: string,
): CommerceError {
  const envelope = errorEnvelopeSchema.safeParse(payload);

  if (envelope.success) {
    const { code, message, details } = envelope.data.error;
    return new CommerceError(ERROR_CODE_MAP[code] ?? "UPSTREAM_ERROR", message, {
      status,
      details,
    });
  }

  return new CommerceError("UPSTREAM_ERROR", `${path} responded ${status}`, {
    status,
    details: payload,
  });
}

/** Every request gets the same hard deadline; there are no caller overrides. */
function withDeadline(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

/**
 * Exponential backoff with full jitter. The randomisation matters more than
 * the delay: without it, every function instance that failed at the same
 * moment retries at the same moment, and a recovering backend is immediately
 * knocked over again by the synchronised herd.
 */
function backoff(attempt: number): Promise<void> {
  const ceiling = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  return new Promise((resolve) => setTimeout(resolve, Math.random() * ceiling));
}
