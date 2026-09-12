import { Suspense } from "react";
import type { Metadata } from "next";
import {
  CategoryFilter,
  CategoryFilterSkeleton,
} from "@/components/commerce/category-filter";
import {
  ProductResults,
  ProductResultsSkeleton,
} from "@/components/commerce/product-results";
import {
  SearchInput,
  SearchInputSkeleton,
} from "@/components/commerce/search-input";
import { Container } from "@/components/ui/container";
import { getCategories, listCatalogue } from "@/lib/data/catalogue";
import { pageMetadata } from "@/lib/seo";

const TITLE = "Search";
const DESCRIPTION =
  "Search the Vercel Swag Store catalogue by name, description or tag, and filter by category.";

/** The brief caps search results at five. */
const RESULT_LIMIT = 5;

/** Shown before any search has been performed. */
const DEFAULT_LIMIT = 6;

type PageProps = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/search" });
}

/**
 * The search page, and the second consumer of the shared listing components —
 * which is what makes that extraction worth having rather than speculative. It
 * differs from the catalogue only in where its products come from.
 *
 * The controls sit outside the Suspense boundary on purpose. Every keystroke
 * that triggers a search re-renders the results; if the input were inside the
 * boundary it would remount on each one and lose the caret mid-word.
 */
export default function SearchPage({ searchParams }: PageProps) {
  return (
    <Container size="wide">
      <div className="flex flex-col gap-8 py-10 sm:py-14">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{TITLE}</h1>
          <p className="text-sm text-muted">{DESCRIPTION}</p>
        </div>

        {/*
          The controls get their own Suspense boundary, separate from the results.
          Two boundaries rather than one is deliberate: `useSearchParams` is
          uncached request data, so these Client Components need a boundary for
          the prerender — but keeping them out of the *results* boundary means a
          search re-renders the list without remounting the input and stealing
          the caret.
        */}
        <Suspense
          fallback={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <SearchInputSkeleton />
              <CategoryFilterSkeleton />
            </div>
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <SearchInput />
            <Filters />
          </div>
        </Suspense>

        {/*
          Keyed on the resolved parameters so a new search re-suspends and shows
          the skeleton, rather than leaving the previous results on screen with no
          indication that anything is happening. The controls keep their own
          pending styling for the sub-second case.
        */}
        <Suspense fallback={<ProductResultsSkeleton count={RESULT_LIMIT} />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}

/** Cached, so the category dropdown is prerendered into the shell. */
async function Filters() {
  const categories = await getCategories();
  return <CategoryFilter categories={categories} basePath="/search" />;
}

async function Results({ searchParams }: PageProps) {
  const { q, category } = await searchParams;
  const query = q?.trim() ?? "";
  const searched = query.length > 0;

  // No query yet is not an empty search — it is the default browse state, so it
  // shows a set of products rather than "no results found".
  const results = await listCatalogue({
    query: searched ? query : undefined,
    category,
    limit: searched ? RESULT_LIMIT : DEFAULT_LIMIT,
  });

  return (
    <div className="flex flex-col gap-4">
      {searched && (
        <p className="text-sm text-muted">
          {results.pagination.total === 0
            ? `No matches for “${query}”`
            : `Showing ${results.items.length} of ${results.pagination.total} match${
                results.pagination.total === 1 ? "" : "es"
              } for “${query}”`}
        </p>
      )}
      <ProductResults
        products={results.items}
        emptyMessage={
          searched ? `No products match “${query}”.` : "No products available."
        }
        emptyHint={
          searched
            ? "Try a shorter term, or clear the category filter."
            : undefined
        }
      />
    </div>
  );
}
