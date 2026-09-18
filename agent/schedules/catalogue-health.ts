import { defineSchedule } from "eve/schedules";
import slack from "../channels/slack";

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

    waitUntil(
      to(slack, { channelId }).send(
        [
          "Compile the daily catalogue health digest for the merchandising team:",
          "1. Call list_categories and flag any category with zero products.",
          "2. Check stock for each of the store's featured products (search with featured items first if needed) and list any that are out of stock or low, with the numbers.",
          "3. Note the currently running promotion, if any.",
          "Keep it under ten short lines of plain text. Lead with the most actionable finding. If everything is healthy, say so in one line instead.",
        ].join("\n"),
        { auth: appAuth },
      ),
    );
  },
});
