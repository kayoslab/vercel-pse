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
  /**
   * The `sizes` hint for the image, supplied by whatever lays the cards out.
   *
   * This belongs to the layout, not the card: only the container knows how wide
   * a card renders at each breakpoint. Hardcoding it here — as this component
   * originally did, matching `ProductGrid` — meant reusing the card in any other
   * arrangement would silently request wrong-sized images. That degrades
   * Lighthouse rather than visibly breaking, so it would not have been caught by
   * looking at the page.
   */
  sizes: string;
};

export function ProductCard({ product, priority = false, sizes }: ProductCardProps) {
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
          sizes={sizes}
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
