import "server-only";
import type { z } from "zod";
import { env } from "@/lib/env";
import { CommerceError, type CommerceErrorCode } from "../errors";
import { errorEnvelopeSchema } from "./schemas";

/**
 * HTTP transport for the Swag Store API.
 *
 * Everything vendor-specific about talking to this service lives here and
 * nowhere else: the base URL, the bypass header, the success/error envelope,
 * and the mapping from upstream error codes to domain ones.
 *
 * `server-only` guarantees the bypass token cannot reach a client bundle —
 * importing this from a Client Component is a build error, not a runtime leak.
 */

/** Upstream error codes we recognise; anything else becomes UPSTREAM_ERROR. */
const ERROR_CODE_MAP: Record<string, CommerceErrorCode> = {
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_SERVER_ERROR: "UPSTREAM_ERROR",
};

export type RequestOptions<TSchema extends z.ZodTypeAny> = {
  /** Path relative to the API base, e.g. `/products`. */
  path: string;
  /** Schema for the whole envelope — validated before anything is returned. */
  schema: TSchema;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Cart token, sent as `x-cart-token` when present. */
  cartToken?: string;
  /**
   * Passed through to `fetch`. Deliberately not defaulted: under Cache
   * Components an uncached fetch is dynamic, and callers opt into caching by
   * wrapping in `use cache` rather than by configuring the transport.
   */
  init?: Pick<RequestInit, "cache" | "signal"> & {
    next?: { revalidate?: number | false; tags?: string[] };
  };
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

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      ...options.init,
    });
  } catch (cause) {
    throw new CommerceError("UPSTREAM_ERROR", `Request to ${options.path} failed`, {
      cause,
    });
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
