import { flag } from "flags/next";
import { vercelAdapter } from "@flags-sdk/vercel";

/**
 * Feature flags, as code — each flag is a callable, evaluated server-side
 * against Vercel Flags (managed in the dashboard or with `vercel flags`),
 * togglable at runtime without a redeploy, overridable per-browser through
 * the Toolbar's Flags Explorer.
 *
 * Both gate *optional* capabilities, so both fail open (`defaultValue:
 * true`): if the flags service is ever unreachable, the store behaves as
 * shipped rather than silently losing features.
 *
 * The eve service (the digest schedule) cannot call these `flags/next`
 * declarations — they need a request context — so it evaluates the same
 * keys through the adapter directly: agent/lib/flags.ts. Keep the keys in
 * sync with that file.
 */
export const lifestyleShotsFlag = flag<boolean>({
  key: "lifestyle-shots",
  description: "PDP generated-merchandising button and its generation route",
  defaultValue: true,
  options: [
    { value: true, label: "On" },
    { value: false, label: "Off" },
  ],
  adapter: vercelAdapter,
});

export const catalogueDigestFlag = flag<boolean>({
  key: "catalogue-digest",
  description: "Daily catalogue-health digest posting to Slack",
  defaultValue: true,
  options: [
    { value: true, label: "On" },
    { value: false, label: "Off" },
  ],
  adapter: vercelAdapter,
});
