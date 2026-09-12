import { ProductGrid, ProductGridSkeleton } from "@/components/commerce/product-grid";
import type { ReactNode } from "react";
import type { Pagination, Product } from "@/lib/commerce";

type ProductResultsProps = {
  products: readonly Product[];
  /** Shown when the list is empty. Phrase it for the calling context. */
  emptyMessage: string;
  /** Optional supporting line under the empty message. */
  emptyHint?: string;
  /**
   * Optional control rendered in the empty state — a way *out* of it. An empty
   * result the shopper cannot act on is a dead end; a reason plus a single
   * escape is not.
   */
  emptyAction?: ReactNode;
  /** Rendered as a count line when supplied. */
  pagination?: Pagination;
  priorityCount?: number;
};

/**
 * Minimum height for the results region, so a short result set does not collapse
 * the page.
 *
 * Without it, filtering 12 products down to 1 shortened the document from
 * 2480px to 943px, which pulled the footer up from off-screen into the viewport
 * and measured 0.20 CLS — poor, and well outside the 0.1 "good" threshold.
 * Google excludes shifts within 500ms of user input as expected consequences of
 * interaction, but a filter that round-trips to the server takes longer than
 * that, so the collapse is counted against the page.
 *
 * Reserving roughly a screenful means the results area always fills the viewport
 * and the footer stays where the shopper left it. Whitespace below a short
 * filtered list is normal on a listing page; content jumping is not.
 */
const MIN_RESULTS_HEIGHT = "min-h-[60dvh]";

/**
 * A list of products, plus the states a list needs: empty, and a result count.
 *
 * Deliberately knows nothing about *where* the products came from. A catalogue
 * page fetches by category and page; the search page fetches by query. Both
 * render identically, which is the point — the alternative is two listing
 * layouts that drift apart, one of which quietly lacks an empty state.
 *
 * Loading is `ProductResultsSkeleton`, rendered by the caller's Suspense
 * boundary rather than a prop here, so the fallback exists in the static shell
 * without this component having to run.
 */
export function ProductResults({
  products,
  emptyMessage,
  emptyHint,
  emptyAction,
  pagination,
  priorityCount = 0,
}: ProductResultsProps) {
  if (products.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center ${MIN_RESULTS_HEIGHT}`}
      >
        <p className="text-base font-medium text-foreground">{emptyMessage}</p>
        {emptyHint && <p className="text-sm text-muted">{emptyHint}</p>}
        {emptyAction && <div className="mt-2">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${MIN_RESULTS_HEIGHT}`}>
      {pagination && (
        <p className="text-sm text-muted" aria-live="polite">
          {pagination.total === 1 ? "1 product" : `${pagination.total} products`}
          {pagination.totalPages > 1 &&
            ` · page ${pagination.page} of ${pagination.totalPages}`}
        </p>
      )}
      <ProductGrid products={products} priorityCount={priorityCount} />
    </div>
  );
}

type ProductResultsSkeletonProps = {
  /** Match the page size so the reserved rows equal the rows that arrive. */
  count: number;
  /** Reserve the count line only if the real results will render one. */
  withCount?: boolean;
};

export function ProductResultsSkeleton({
  count,
  withCount = true,
}: ProductResultsSkeletonProps) {
  return (
    <div className={`flex flex-col gap-6 ${MIN_RESULTS_HEIGHT}`}>
      {/* Reserves the count line's exact height rather than shimmering it. */}
      {withCount && <p className="text-sm text-transparent">&nbsp;</p>}
      <ProductGridSkeleton count={count} />
    </div>
  );
}
