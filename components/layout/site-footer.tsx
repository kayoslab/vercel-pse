import { cacheLife } from "next/cache";
import { Container } from "@/components/ui/container";

/**
 * `use cache` here is load-bearing, not decorative.
 *
 * Cache Components rejects non-deterministic values — `new Date()` included —
 * in an uncached scope, because a prerender cannot produce a stable result from
 * them. The build fails with a prerender error rather than silently baking in
 * whatever the build machine's clock said.
 *
 * Inside a cached scope it is legal: the value resolves once when the entry is
 * produced. That is the right trade for a copyright line — making the footer
 * dynamic to keep a number current would cost every page in the site its
 * static shell. It rolls over on the first deploy of a new year, which is how
 * essentially every site handles it.
 */
export async function SiteFooter() {
  "use cache";
  cacheLife("max");

  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container size="wide">
        <div className="flex flex-col items-center justify-between gap-2 py-8 text-xs text-muted sm:flex-row sm:text-sm">
          <p>© {year} Vercel Swag Store. All rights reserved.</p>
          <p>Built with Next.js on Vercel.</p>
        </div>
      </Container>
    </footer>
  );
}
