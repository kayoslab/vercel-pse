import { defineAgent } from "eve";

/**
 * The store agent's runtime config.
 *
 * The model id is an AI Gateway slug, which keeps the project's headline ops
 * property intact under eve: there is no AI provider API key anywhere — the
 * Gateway authenticates via Vercel OIDC, provisioned and rotated by the
 * platform. Same model the AI SDK assistant used, now behind a durable runtime.
 */
export default defineAgent({
  model: "anthropic/claude-opus-5",
});
