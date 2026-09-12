import { Suspense } from "react";
import type { Metadata } from "next";
import {
  CategoryFilter,
  CategoryFilterSkeleton,
} from "@/components/commerce/category-filter";
import { PaginationControls } from "@/components/commerce/pagination-controls";
import {
  ProductResults,
  ProductResultsSkeleton,
} from "@/components/commerce/product-results";
import { Container } from "@/components/ui/container";
import { getCategoryFacets, listCatalogue } from "@/lib/data/catalogue";
import { pageMetadata } from "@/lib/seo";

const TITLE = "All Products";
const DESCRIPTION =
  "Browse the full Vercel Swag Store catalogue — apparel, drinkware, desk gear, bags and accessories.";

/** A dozen fills three rows of the grid at desktop widths without a long scroll. */
const PAGE_SIZE = 12;

type PageProps = {
  searchParams: Promise<{ category?: string; page?: string }>;
};

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/products" });
}

/**
 * The catalogue listing.
 *
 * Note what this component does *not* do: it never awaits `searchParams`. Doing
 * so here would make the whole page dynamic and there would be no static shell.
 * The promise goes to a child inside Suspense, so the heading, the filter and
 * the layout all prerender and only the results stream.
 */
export default function ProductsPage({ searchParams }: PageProps) {
  return (
    <Container size="wide">
      <div className="flex flex-col gap-8 py-10 sm:py-14">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{TITLE}</h1>
          <p className="text-sm text-muted">{DESCRIPTION}</p>
        </div>

        <Suspense fallback={<CategoryFilterSkeleton />}>
          <Filters />
        </Suspense>

        <Suspense fallback={<ProductResultsSkeleton count={PAGE_SIZE} />}>
          <Catalogue searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}

/**
 * Cached, so the filter is part of the prerendered shell and usable before any
 * results arrive. It reads its own selection from the URL client-side, which is
 * what keeps it out of the dynamic boundary.
 */
async function Filters() {
  // No query here, so the counts are the catalogue's own per-category totals.
  const options = await getCategoryFacets();
  return <CategoryFilter options={options} basePath="/products" />;
}

async function Catalogue({ searchParams }: PageProps) {
  const { category, page } = await searchParams;

  // A malformed ?page= must not produce NaN and a broken request.
  const parsed = Number(page);
  const currentPage = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;

  const results = await listCatalogue({
    category,
    page: currentPage,
    limit: PAGE_SIZE,
  });

  const hrefForPage = (next: number) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (next > 1) params.set("page", String(next));
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  };

  return (
    <div className="flex flex-col gap-8">
      <ProductResults
        products={results.items}
        pagination={results.pagination}
        emptyMessage="No products in this category yet."
        emptyHint="Try a different category, or browse everything."
        priorityCount={3}
      />
      <PaginationControls pagination={results.pagination} hrefForPage={hrefForPage} />
    </div>
  );
}
