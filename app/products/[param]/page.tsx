import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LifestyleShotGhost } from "@/components/commerce/lifestyle-shot";
import { LifestyleShotGate } from "@/components/commerce/lifestyle-shot-gate";
import { Price } from "@/components/commerce/price";
import {
  PurchasePanel,
  PurchasePanelSkeleton,
} from "@/components/commerce/purchase-panel";
import { Container } from "@/components/ui/container";
import { getAllProductSlugs, getProduct } from "@/lib/data/catalogue";
import { toDecimalString } from "@/lib/money";
import { pageMetadata, SITE_URL } from "@/lib/seo";

type PageProps = {
  /** The brief names this segment `param`, so the folder and type match it. */
  params: Promise<{ param: string }>;
};

/**
 * Prerenders every product page at build time.
 *
 * The catalogue is 28 products, so rendering all of them costs a few seconds
 * of build and means no shopper is ever the first to request a product page.
 * Each one ships as static HTML from the CDN with a single streamed hole for
 * availability. A catalogue of 100,000 SKUs would return only the top sellers
 * here and let the long tail fill in on first request — the shape of the code
 * would not change.
 */
export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.map((param) => ({ param }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { param } = await params;
  const product = await getProduct(param);

  if (!product) {
    return { title: "Product not found" };
  }

  const base = await pageMetadata({
    title: product.name,
    description: product.description,
    path: `/products/${product.slug}`,
  });

  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      // The product shot is the share image. Without this a shared link shows
      // the store's generic card, which converts far worse than the product.
      images: [{ url: product.images[0], alt: product.name }],
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { param } = await params;
  const product = await getProduct(param);

  // A bad slug is an expected outcome for a user-typed or stale URL, not an
  // error — render the 404 page rather than a crash.
  if (!product) notFound();

  /*
   * Product structured data for rich results. Built from the same cached
   * product read as the page, so it prerenders into the static shell.
   * `availability` is deliberately absent: stock randomises per request, so
   * any availability claim baked into a cached shell would be wrong by the
   * time a crawler read it — a missing field reads as "unknown", a wrong one
   * as a lie. The `<` escape keeps API-sourced text from ever closing the
   * script tag.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.id,
    brand: { "@type": "Brand", name: "Vercel" },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/products/${product.slug}`,
      priceCurrency: product.price.currency,
      price: toDecimalString(product.price),
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <Container size="wide">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="grid gap-8 py-10 sm:py-14 lg:grid-cols-2 lg:gap-14">
        {/*
          Aspect-ratio box reserves the image's space before it loads. This
          image is the LCP element at every viewport, so it is fetched eagerly
          with fetchPriority="high" — the Next 16 replacement for the
          deprecated `priority` prop. The page is prerendered static HTML, so
          the request is discovered as soon as the document arrives.
        */}
        <div className="flex flex-col gap-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-surface">
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              loading="eager"
              fetchPriority="high"
              className="object-cover"
            />
          </div>
          {/*
            Generated merchandising: the product's own photo restyled by an
            image model through the AI Gateway (lib/lifestyle.ts). Lives in
            the image column so its click-to-expand box grows under the
            gallery rather than pushing the purchase panel. Feature-flagged:
            the gate reads the flag in its own Suspense hole (a flag read is
            request data), with the exact button as an invisible fallback so
            the decision streams in without moving anything.
          */}
          <Suspense
            fallback={
              <LifestyleShotGhost
                worn={["t-shirts", "hoodies", "socks", "hats"].includes(product.category)}
              />
            }
          >
            <LifestyleShotGate
              productParam={product.slug}
              productName={product.name}
              worn={["t-shirts", "hoodies", "socks", "hats"].includes(product.category)}
            />
          </Suspense>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              {product.category.replace(/-/g, " ")}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {product.name}
            </h1>
            <Price value={product.price} className="text-2xl font-medium" />
          </div>

          <p className="text-base leading-relaxed text-muted">{product.description}</p>

          <Suspense fallback={<PurchasePanelSkeleton />}>
            <PurchasePanel productId={product.id} />
          </Suspense>

          {product.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2 pt-2">
              {product.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Container>
  );
}
