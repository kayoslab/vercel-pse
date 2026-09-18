import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";
import * as capabilities from "@/lib/agent/capabilities";
import { formatMoney, money } from "@/lib/money";

/**
 * The Slack surface of the store agent.
 *
 * Credentials live in Vercel Connect — no Slack token or signing secret ever
 * enters this project's environment.
 *
 * The authored `input.requested` handler exists for one reason: the
 * framework's default approval card is developer-facing ("Approve tool call:
 * add_to_cart" plus the raw input JSON), and a shopper is not a developer.
 * `defaultDeliver` renders whatever the event carries, so the handler hands
 * it a prettified clone: shopper copy composed from a product lookup
 * ("Before I spend your money: add 1 × Black Pullover Hoodie to your cart
 * for $60.00?"), and the action input replaced with `{}` — the renderer's
 * own empty-input path, which cleanly suppresses the JSON block. Response routing rides the requestId,
 * not the input, so the buttons keep working. Anything unexpected — an
 * unknown tool, a failed lookup, a shape change — falls through to the
 * default rendering untouched: worst case is ugly, never broken.
 */
export default slackChannel({
  credentials: connectSlackCredentials("slack/vercel-swag-store"),
  events: {
    async "input.requested"(event, _channel, _ctx, defaultDeliver) {
      try {
        const requests = await Promise.all(
          event.requests.map(async (request) => {
            if (request.kind !== "tool-approval") return request;
            if (request.action.toolName !== "add_to_cart") return request;

            const input = request.action.input as {
              productId?: unknown;
              quantity?: unknown;
            };
            if (typeof input.productId !== "string") return request;
            const quantity =
              typeof input.quantity === "number" ? input.quantity : 1;

            const details = await capabilities.getProductDetails({
              idOrSlug: input.productId,
            });
            if (!details.found) return request;

            const total = formatMoney(
              money(details.product.priceCents * quantity, details.product.currency),
              "en-US",
            );
            return {
              ...request,
              prompt: `Before I spend your money: add ${quantity} × ${details.product.name} to your cart for ${total}?`,
              action: { ...request.action, input: {} },
            };
          }),
        );
        await defaultDeliver({ ...event, requests });
      } catch {
        await defaultDeliver(event);
      }
    },
  },
});
