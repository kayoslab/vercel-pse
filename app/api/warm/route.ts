import { NextResponse } from "next/server";

/**
 * Warms the remote cache so the first visitor after a deploy does not pay the
 * upstream.
 *
 * Every request-time read in this store is remote-cached with an hour of
 * revalidation and a day of expiry; between those the cache serves stale and
 * refreshes in the background, so a route is only ever cold once per deploy
 * (and once a day after that). Cold costs 2–3 seconds against this API, warm
 * costs tens of milliseconds. One pass over the routes a visitor is likely to
 * hit first turns the cold case into something nobody sees.
 *
 * Registered as a Vercel Cron (`vercel.json`, daily at 06:00 UTC — an hour
 * ahead of the catalogue-health digest, and once a day because that is the
 * one frequency guaranteed on every Vercel plan). Vercel signs cron
 * invocations with `Authorization: Bearer $CRON_SECRET` automatically, so the
 * guard below is what makes this the Vercel scheduler's request and not
 * anyone who finds the URL. A cron entry can't fire on a deploy, so
 * `.github/workflows/warm-after-deploy.yml` calls this with the same token
 * when a production deployment succeeds — the cron closes the "nobody
 * remembered" case, the workflow the "right after shipping" one.
 *
 * Fails closed: a missing `CRON_SECRET` denies the request rather than
 * admitting it. The earlier version only checked the header when the secret
 * was set, which meant an unset secret — the state this project was
 * deployed in until now — left the route open to anyone.
 */
const PATHS = [
  "/",
  "/products",
  "/products?page=2",
  "/products?page=3",
  "/search",
  "/search?q=mug",
  "/search?q=hoodie",
  "/search?q=black",
  "/search?q=bottle",
  "/cart",
];

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const started = Date.now();

  const results = await Promise.all(
    PATHS.map(async (path) => {
      const t = Date.now();
      try {
        const res = await fetch(origin + path, { cache: "no-store", headers: { "user-agent": "warm" } });
        return { path, status: res.status, ms: Date.now() - t };
      } catch (error) {
        return { path, status: 0, ms: Date.now() - t, error: String(error) };
      }
    }),
  );

  return NextResponse.json({ ms: Date.now() - started, results });
}
