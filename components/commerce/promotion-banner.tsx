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
        {/*
          The code is the actionable part of the banner and never truncates.
          The description is the first thing to go on a narrow screen — a
          banner that cuts off its own promo code is pure noise.
        */}
        <p className="flex min-w-0 items-baseline gap-1.5 text-xs text-foreground sm:text-sm">
          <span className="truncate font-medium">{promotion.title}</span>
          <span className="hidden min-w-0 truncate text-muted sm:block">
            — {promotion.description}
          </span>
          <span className="shrink-0 font-mono font-medium">{promotion.code}</span>
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
