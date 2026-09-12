import { Suspense } from "react";
import Link from "next/link";
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
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getCategoryFacets, listCatalogue } from "@/lib/data/catalogue";
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
          Two boundaries in this row, not one shared between the controls.

          The filter's counts depend on the query, so it re-renders on every
          search. If it shared a boundary with the input, that boundary would
          re-suspend on each keystroke, remount the input and take the caret with
          it — which makes typing impossible. Separate boundaries let the filter
          refresh while the input keeps its identity.

          Both still need a boundary of their own: `useSearchParams` counts as
          uncached request data under Cache Components, so the build rejects
          either one outside Suspense.
        */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Suspense fallback={<SearchInputSkeleton />}>
            <SearchInput />
          </Suspense>
          <Suspense fallback={<CategoryFilterSkeleton />}>
            <Filters searchParams={searchParams} />
          </Suspense>
        </div>

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

/**
 * Counts are scoped to the active query so the dropdown cannot claim matches it
 * does not have, and categories with no matches are omitted entirely.
 */
async function Filters({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const options = await getCategoryFacets(q);
  return <CategoryFilter options={options} basePath="/search" />;
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

  /*
   * A new search term clears the category, so this combination can only arise
   * deliberately — by picking a category while a search is already active. It is
   * still worth naming: an empty result has to explain itself, and the fastest
   * way out of a filter that is hiding everything is a link that drops it.
   */
  const narrowedByCategory = searched && results.items.length === 0 && Boolean(category);
  const categoryLabel = category?.replace(/-/g, " ");

  return (
    <div className="flex flex-col gap-4">
      {searched && (
        <p className="text-sm text-muted">
          {results.pagination.total === 0
            ? `No matches for “${query}”${narrowedByCategory ? ` in ${categoryLabel}` : ""}`
            : `Showing ${results.items.length} of ${results.pagination.total} match${
                results.pagination.total === 1 ? "" : "es"
              } for “${query}”`}
        </p>
      )}
      <ProductResults
        products={results.items}
        emptyMessage={
          narrowedByCategory
            ? `No ${categoryLabel} match “${query}”.`
            : searched
              ? `No products match “${query}”.`
              : "No products available."
        }
        emptyHint={
          narrowedByCategory
            ? "The category filter is narrowing these results."
            : searched
              ? "Try a shorter or more general term."
              : undefined
        }
        emptyAction={
          narrowedByCategory ? (
            <Link
              href={`/search?q=${encodeURIComponent(query)}`}
              className={buttonStyles({ variant: "secondary" })}
            >
              Search all categories
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}
