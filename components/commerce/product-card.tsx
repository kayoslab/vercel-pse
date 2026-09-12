import Image from "next/image";
import Link from "next/link";
import { Price } from "@/components/commerce/price";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/lib/commerce";

/**
 * Shared by the homepage grid and search results, so the two cannot diverge.
 */
type ProductCardProps = {
  product: Product;
  /**
   * Set on the first card above the fold. It marks the image as the likely LCP
   * element so Next preloads it instead of lazy-loading the thing the score is
   * measured against.
   */
  priority?: boolean;
};

/**
 * Matches the grid breakpoints in `ProductGrid`. Getting this wrong is the
 * quiet way to ship a 1600px image into a 300px slot, which shows up as a poor
 * Lighthouse score rather than as a visible bug.
 */
const IMAGE_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export function ProductCard({ product, priority = false }: ProductCardProps) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/*
        Fixed aspect ratio reserves the image's box before the bytes arrive, so
        the card never changes height as images load. This is the single most
        effective CLS measure on a product grid.
      */}
      <div className="relative aspect-square w-full overflow-hidden bg-surface">
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes={IMAGE_SIZES}
          priority={priority}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-sm font-medium leading-snug text-foreground">{product.name}</h3>
        <Price value={product.price} className="text-sm text-muted" />
      </div>
    </Link>
  );
}

/**
 * The card's placeholder. Deliberately mirrors the card's own structure —
 * same aspect-square image box, same padding, same two text rows at the same
 * heights — so swapping one for the other moves nothing.
 */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised">
      <Skeleton className="aspect-square w-full" rounded={false} />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/4" />
      </div>
    </div>
  );
}
