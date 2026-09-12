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

/** Breakpoints here and `IMAGE_SIZES` in ProductCard must stay in agreement. */
const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3";

export function ProductGrid({ products, priorityCount = 0 }: ProductGridProps) {
  return (
    <div className={GRID}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={index < priorityCount}
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
