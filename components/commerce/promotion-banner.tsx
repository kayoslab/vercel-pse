import { getActivePromotion } from "@/lib/data/promotions";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fixed height across all three states — loading, promotion, no promotion.
 *
 * This banner sits above everything else on the page, so any change in its
 * height pushes the entire viewport down. That is the textbook layout-shift
 * trap for a streamed component, and reserving the row solves it: the bar
 * occupies the same space whether it is shimmering, showing an offer, or empty
 * because the promotions endpoint is down. A few pixels of empty bar in the
 * rare no-promotion case is a much better trade than a visible jump on every
 * page load.
 */
const BAR = "h-10 border-b border-border bg-surface";

export async function PromotionBanner() {
  const promotion = await getActivePromotion();

  if (!promotion) {
    // The slot still occupies its row. Nothing moves.
    return <div className={BAR} aria-hidden />;
  }

  return (
    <div className={BAR}>
      <Container size="wide" className="flex h-full items-center justify-center">
        <p className="truncate text-xs text-foreground sm:text-sm">
          <span className="font-medium">{promotion.title}</span>
          <span className="text-muted"> — {promotion.description} </span>
          <span className="font-mono font-medium">{promotion.code}</span>
        </p>
      </Container>
    </div>
  );
}

export function PromotionBannerSkeleton() {
  return (
    <div className={BAR}>
      <Container size="wide" className="flex h-full items-center justify-center">
        <Skeleton className="h-4 w-64" />
      </Container>
    </div>
  );
}
