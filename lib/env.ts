import "server-only";
import { z } from "zod";

/**
 * Server-only environment access.
 *
 * The `server-only` import is a build-time guard: if any of this is ever
 * imported from a Client Component, the build fails rather than silently
 * shipping the API credentials to the browser.
 *
 * Validation is lazy rather than at module load so that importing this file
 * never crashes a build for a route that does not actually need the API.
 */
const schema = z.object({
  SWAG_API_BASE_URL: z.string().url(),
  SWAG_API_BYPASS_TOKEN: z.string().min(1),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse({
    SWAG_API_BASE_URL: process.env.SWAG_API_BASE_URL,
    SWAG_API_BYPASS_TOKEN: process.env.SWAG_API_BYPASS_TOKEN,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(
      `Invalid commerce API environment configuration — ${missing}. ` +
        `Run \`vercel env pull\` to populate .env.local.`,
    );
  }

  cached = parsed.data;
  return cached;
}
