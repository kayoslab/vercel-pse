import { Suspense } from "react";
import {
  PromotionBanner,
  PromotionBannerSkeleton,
} from "@/components/commerce/promotion-banner";
import { ProductGrid } from "@/components/commerce/product-grid";
import { Hero } from "@/components/home/hero";
import { Container } from "@/components/ui/container";
import { getFeaturedProducts } from "@/lib/data/catalogue";
import { pageMetadata } from "@/lib/seo";

const TITLE = "Official Vercel Merchandise";
const DESCRIPTION =
  "Shop the Vercel Swag Store — premium developer apparel, drinkware, desk gear and accessories.";

/**
 * Extends the root metadata. `rootSegment` is set because `app/page.tsx` shares
 * a route segment with the root layout, so the layout's title template does not
 * reach it — see `lib/seo.ts`.
 */
export function generateMetadata() {
  return pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/", rootSegment: true });
}

/** Matches the API's featured count, so the skeleton reserves the right rows. */
const FEATURED_COUNT = 6;

export default function HomePage() {
  return (
    <>
      {/*
        The one dynamic hole on this page. The banner's row is height-reserved
        in every state, so it streams in without moving the hero beneath it.
      */}
      <Suspense fallback={<PromotionBannerSkeleton />}>
        <PromotionBanner />
      </Suspense>

      <Hero />

      {/*
        No Suspense around the grid, and that is the point: `getFeaturedProducts`
        is cached, so this renders at build time into the static shell. The
        products are in the HTML the CDN serves — there is nothing to stream and
        nothing to reserve space for.
      */}
      <Container size="wide">
        <section className="py-16 sm:py-20" aria-labelledby="featured-heading">
          <div className="mb-8 flex flex-col gap-2">
            <h2
              id="featured-heading"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Featured products
            </h2>
            <p className="text-sm text-muted">
              Hand-picked favourites from the collection.
            </p>
          </div>
          <FeaturedProducts />
        </section>
      </Container>
    </>
  );
}

async function FeaturedProducts() {
  const products = await getFeaturedProducts(FEATURED_COUNT);

  // Preload the first row only. Marking everything priority would defeat the
  // purpose — the browser cannot prioritise six images over each other.
  return <ProductGrid products={products} priorityCount={3} />;
}
