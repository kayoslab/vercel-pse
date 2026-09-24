import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import type { Pagination } from "@/lib/commerce";

type PaginationControlsProps = {
  pagination: Pagination;
  /** Builds the href for a page, preserving whatever else is in the URL. */
  hrefForPage: (page: number) => string;
};

/**
 * Pagination as plain links, not buttons with click handlers.
 *
 * That makes it work with no JavaScript, keeps each page a real shareable URL,
 * and lets the router prefetch the next page on hover. A client component with
 * `router.push` would ship JS to do worse.
 *
 * `prefetch` is deliberately asymmetric across the app: these links prefetch
 * the FULL route (the results hole is cached catalogue data — cheap, and by
 * click time the next page has usually already streamed), while product card
 * links keep the default shell-only prefetch, because their stock hole is
 * real-time data that must not be fetched speculatively and would be stale by
 * click anyway. Same classification that drives the caching spine, applied
 * to prefetching.
 */
export function PaginationControls({ pagination, hrefForPage }: PaginationControlsProps) {
  if (pagination.totalPages <= 1) return null;

  const { page, totalPages, hasPreviousPage, hasNextPage } = pagination;

  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
      {hasPreviousPage ? (
        <Link
          href={hrefForPage(page - 1)}
          prefetch={true}
          className={buttonStyles({ variant: "secondary" })}
        >
          ← Previous
        </Link>
      ) : (
        // A disabled span rather than a hidden element: removing it would let
        // the "Next" button jump across the row between pages.
        <span className={`${buttonStyles({ variant: "secondary" })} pointer-events-none opacity-40`}>
          ← Previous
        </span>
      )}

      <p className="text-sm text-muted">
        Page {page} of {totalPages}
      </p>

      {hasNextPage ? (
        <Link
          href={hrefForPage(page + 1)}
          prefetch={true}
          className={buttonStyles({ variant: "secondary" })}
        >
          Next →
        </Link>
      ) : (
        <span className={`${buttonStyles({ variant: "secondary" })} pointer-events-none opacity-40`}>
          Next →
        </span>
      )}
    </nav>
  );
}
