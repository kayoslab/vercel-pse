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
import { getCategories, listCatalogue } from "@/lib/data/catalogue";
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
 * Instead the promise is handed to a child inside a Suspense boundary, so the
 * heading and layout prerender and only the filtered results stream. This is the
 * same shape as the product page — static frame, one dynamic hole.
 */
export default function ProductsPage({ searchParams }: PageProps) {
  return (
    <Container size="wide">
      <div className="flex flex-col gap-8 py-10 sm:py-14">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{TITLE}</h1>
          <p className="text-sm text-muted">{DESCRIPTION}</p>
        </div>

        <Suspense
          fallback={
            <div className="flex flex-col gap-8">
              <CategoryFilterSkeleton />
              <ProductResultsSkeleton count={PAGE_SIZE} />
            </div>
          }
        >
          <Catalogue searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}

async function Catalogue({ searchParams }: PageProps) {
  const { category, page } = await searchParams;

  // A malformed ?page= must not produce NaN and a broken request.
  const parsed = Number(page);
  const currentPage = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;

  // Categories are cached and independent of the filter, so both reads start
  // together rather than the list waiting on the dropdown's data.
  const [categories, results] = await Promise.all([
    getCategories(),
    listCatalogue({ category, page: currentPage, limit: PAGE_SIZE }),
  ]);

  const hrefForPage = (next: number) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (next > 1) params.set("page", String(next));
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  };

  return (
    <div className="flex flex-col gap-8">
      <CategoryFilter categories={categories} selected={category} basePath="/products" />
      <ProductResults
        products={results.items}
        pagination={results.pagination}
        emptyMessage="No products in this category yet."
        emptyHint="Try a different category, or browse everything."
        // The first row is above the fold on this page, unlike search results
        // which sit below a search box.
        priorityCount={3}
      />
      <PaginationControls pagination={results.pagination} hrefForPage={hrefForPage} />
    </div>
  );
}
