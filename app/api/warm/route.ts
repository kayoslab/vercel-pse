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
 * Hit after each deploy and on a schedule. Protected by the cron secret so it
 * cannot be used to make the store fetch its own pages on demand.
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
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
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
