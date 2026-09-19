import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";
import * as flags from "@/flags";

/**
 * Flags Explorer discovery: lets the Vercel Toolbar list this app's flags
 * and set per-browser overrides. Authenticated with FLAGS_SECRET by the
 * helper — this is not an open endpoint.
 */
export const GET = createFlagsDiscoveryEndpoint(async () => getProviderData(flags));
