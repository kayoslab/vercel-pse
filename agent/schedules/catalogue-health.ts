import { defineSchedule } from "eve/schedules";
import slack from "../channels/slack";
import { serviceFlagEnabled } from "../lib/flags";

/**
 * The daily merchandising digest: the agent sweeps its own catalogue and
 * reports into a Slack channel — the "ops automation that happens to
 * converse" case. On Vercel this compiles to a Cron Job; the handler starts a
 * session on the Slack channel with the app principal, and the agent does the
 * sweep with the same tools every other surface uses.
 *
 * The target channel is configuration, not code: SLACK_DIGEST_CHANNEL_ID (a
 * Slack channel id like C0123ABCDEF — the bot must be invited to it). With no
 * channel configured the schedule is a silent no-op rather than an error, so
 * the deployment does not depend on Slack being set up.
 *
 * 07:00 UTC — before the DACH working day starts.
 */
export default defineSchedule({
  cron: "0 7 * * *",
  async run({ to, waitUntil, appAuth }) {
    const channelId = process.env.SLACK_DIGEST_CHANNEL_ID;
    if (!channelId) return;

    // Runtime kill switch, no redeploy: the same Vercel Flag the storefront
    // reads, evaluated here through the adapter directly (agent/lib/flags.ts)
    // because the cron fires in the eve service, outside any Next request.
    if (!(await serviceFlagEnabled("catalogue-digest"))) return;

    waitUntil(
      to(slack, { channelId }).send(
        [
          "Compile the daily catalogue health digest for the merchandising team:",
          "1. Call list_categories and flag any category with zero products.",
          "2. Fetch the featured products (search_products with featured=true), check stock for each, and list any that are out of stock or low, with the numbers.",
          "3. Call get_promotion and note the running promotion's code and discount, or that none is running.",
          "Keep it under ten short lines of plain text. Lead with the most actionable finding. If everything is healthy, say so in one line instead.",
        ].join("\n"),
        { auth: appAuth },
      ),
    );
  },
});
