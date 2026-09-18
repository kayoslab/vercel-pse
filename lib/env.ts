import { z } from "zod";

/**
 * Server-side environment access.
 *
 * Runtime-neutral by design: this module is consumed by the Next.js app AND
 * the eve agent service, and the `server-only` marker throws outside a React
 * Server Components bundle. The build-time guard against client imports
 * therefore lives one layer up, in the Next-facing entry points (`lib/data/*`,
 * `lib/seo.ts`) — nothing under `app/` reaches this module except through
 * those or through Server Actions, which cannot be imported by client code.
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
