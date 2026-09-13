import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { cacheTags } from "@/lib/cache-tags";
import { createCommerceTools, type CartSession } from "@/lib/agent/tools";
import { SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import { CART_COOKIE } from "@/lib/data/cart";

/**
 * The in-app assistant.
 *
 * Model is Claude Opus 5 through Vercel AI Gateway, authenticated by OIDC — there
 * is no AI provider key anywhere in this project. `vercel env pull` provisions a
 * short-lived VERCEL_OIDC_TOKEN locally and Vercel refreshes it in deployments,
 * so the credential is never stored and never has to be rotated.
 */
const MODEL = "anthropic/claude-opus-5";

/**
 * A shopping answer may legitimately need several tool calls — search, then
 * check stock, then add — and the default stops after one step. Eight is enough
 * for a multi-item request while still bounding a runaway loop.
 */
const MAX_STEPS = 8;

/**
 * Cart session for a *streamed* route handler.
 *
 * `ensure` deliberately does not create a cart. Response headers are already
 * flushed by the time a tool executes, so a cookie set here would be dropped and
 * the agent would add items to a cart the browser never learns about — telling
 * the shopper it worked while their cart stays empty. Failing loudly instead is
 * the honest option, and `ensureCartSession()` (a Server Action, called when the
 * assistant opens) makes it unreachable in practice.
 */
function routeCartSession(): CartSession {
  return {
    peek: async () => (await cookies()).get(CART_COOKIE)?.value,
    ensure: async () => {
      const token = (await cookies()).get(CART_COOKIE)?.value;
      if (!token) {
        throw new Error("No cart session — the client must call ensureCartSession first.");
      }
      return token;
    },
    // Route Handlers cannot call `updateTag`; `revalidateTag` with a profile is
    // the supported form here. The assistant states the new count in its reply,
    // so stale-while-revalidate on the badge is not user-visible.
    invalidate: (token) => revalidateTag(cacheTags.cart(token), "max"),
  };
}

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: MODEL,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: createCommerceTools(routeCartSession()),
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: {
      gateway: {
        // Cost attribution in the AI Gateway dashboard, so assistant spend is
        // separable from anything else this project might add later.
        tags: ["feature:assistant", "app:swag-store"],
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
