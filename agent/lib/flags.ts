import type { Adapter } from "flags";

/**
 * Flag evaluation for the eve service.
 *
 * The `flags/next` declarations in the root flags.ts need a Next.js request
 * context; the digest schedule runs in the agent service, which has none.
 * Same flag store, same keys, different entry: the Vercel adapter's `decide`
 * called directly. Env (FLAGS_SECRET) is project-wide, so both services
 * read the same source of truth — one toggle governs the cron and the
 * storefront alike.
 *
 * Fails open, matching the declarations' `defaultValue: true`: an
 * unreachable flags service must degrade to "as shipped", not to silently
 * missing features.
 */
export async function serviceFlagEnabled(key: string): Promise<boolean> {
  try {
    const { vercelAdapter } = await import("@flags-sdk/vercel");
    const adapter = vercelAdapter() as Adapter<boolean, undefined>;
    const value = await Promise.race([
      adapter.decide({
        key,
        entities: undefined,
        headers: new Headers() as never,
        cookies: { getAll: () => [], get: () => undefined } as never,
      }),
      // A flags hiccup must not stall a cron tick.
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000)),
    ]);
    return value !== false;
  } catch {
    return true;
  }
}
