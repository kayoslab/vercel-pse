/**
 * A single error type across every provider, so call sites branch on domain
 * meaning rather than on one vendor's HTTP status codes or error strings.
 */
export type CommerceErrorCode =
  /** The upstream service returned a shape that failed validation. */
  | "INVALID_RESPONSE"
  /** Request rejected as malformed (missing headers, bad body). */
  | "BAD_REQUEST"
  /** Request body or query parameters failed the upstream's validation. */
  | "VALIDATION_ERROR"
  /** Resource does not exist — also how an expired cart token presents. */
  | "NOT_FOUND"
  /** Upstream failure, transport error, or anything else unexpected. */
  | "UPSTREAM_ERROR";

export class CommerceError extends Error {
  readonly code: CommerceErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code: CommerceErrorCode,
    message: string,
    options?: { status?: number; details?: unknown; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "CommerceError";
    this.code = code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

export function isCommerceError(error: unknown): error is CommerceError {
  return error instanceof CommerceError;
}

export function isNotFound(error: unknown): boolean {
  return isCommerceError(error) && error.code === "NOT_FOUND";
}
