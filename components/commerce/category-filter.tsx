"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Category } from "@/lib/commerce";

type CategoryFilterProps = {
  categories: readonly Category[];
  /** Path to navigate within, so this serves both the catalogue and search. */
  basePath: string;
};

/**
 * Category select that writes straight to the URL.
 *
 * It reads the current selection from `useSearchParams` rather than taking it as
 * a prop, which is what lets it live in the static shell: a server component
 * reading `searchParams` would have to sit inside a Suspense boundary, and the
 * control would then only become interactive once the results finished loading.
 *
 * Every other parameter is carried across, so a category change preserves an
 * active search term — except `page`, which is dropped. Staying on page 3 while
 * switching to a category with one page of results is how a filter ends up
 * showing an empty list.
 */
export function CategoryFilter({ categories, basePath }: CategoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const selected = searchParams.get("category") ?? "";

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("category", value);
    else params.delete("category");
    params.delete("page");

    const qs = params.toString();
    // Inside a transition so the current results stay on screen while the new
    // ones load, rather than the list blanking.
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="category" className="shrink-0 text-sm text-muted">
        Category
      </label>
      <select
        id="category"
        name="category"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        aria-busy={pending}
        className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface-raised px-3 text-sm text-foreground transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-busy:opacity-60 sm:flex-none"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name} ({c.productCount})
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Same dimensions as the real control. Needed because `useSearchParams` counts
 * as uncached request data under Cache Components, so the filter must sit inside
 * a Suspense boundary even though it is a Client Component.
 */
export function CategoryFilterSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <span className="shrink-0 text-sm text-muted">Category</span>
      <div className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface sm:w-44 sm:flex-none" />
    </div>
  );
}
