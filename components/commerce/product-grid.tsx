import { ProductCard, ProductCardSkeleton } from "@/components/commerce/product-card";
import type { Product } from "@/lib/commerce";

type ProductGridProps = {
  products: readonly Product[];
  /**
   * How many leading images to mark as priority. Defaults to 0 — only a grid
   * that is genuinely above the fold should preload, and preloading everything
   * is the same as preloading nothing.
   */
  priorityCount?: number;
};

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3";

/**
 * The `sizes` hint corresponding to `GRID`'s breakpoints. Declared next to the
 * layout it describes so the two cannot drift apart — previously the card held
 * this string and had no way to know what container it was in.
 */
const GRID_IMAGE_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export function ProductGrid({ products, priorityCount = 0 }: ProductGridProps) {
  return (
    <div className={GRID}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={index < priorityCount}
          sizes={GRID_IMAGE_SIZES}
        />
      ))}
    </div>
  );
}

type ProductGridSkeletonProps = {
  /** Match the number of products the grid will actually render. */
  count: number;
};

export function ProductGridSkeleton({ count }: ProductGridSkeletonProps) {
  return (
    <div className={GRID}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
