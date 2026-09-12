"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Category } from "@/lib/commerce";

type CategoryFilterProps = {
  categories: readonly Category[];
  /** Current selection, resolved on the server from `searchParams`. */
  selected?: string;
  /**
   * Base path to navigate within, so this works on both the catalogue and the
   * search page without knowing which one it is in.
   */
  basePath: string;
  /** Params to carry across a category change — the search term, typically. */
  preserve?: Readonly<Record<string, string>>;
};

/**
 * Category select that writes straight to the URL.
 *
 * State lives in `searchParams`, not in component state, so a filtered view is
 * shareable, survives reload, and needs no client cache of its own. Changing
 * category also drops `page`: staying on page 3 while switching to a category
 * with one page of results is how a filter ends up showing an empty list.
 */
export function CategoryFilter({
  categories,
  selected,
  basePath,
  preserve,
}: CategoryFilterProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onChange = (value: string) => {
    const params = new URLSearchParams(preserve);
    if (value) params.set("category", value);
    const qs = params.toString();
    // Inside a transition so React keeps the current results on screen while the
    // new ones load, rather than blanking the list. Without this the shopper
    // gets no acknowledgement that their filter registered — the select changes
    // and then nothing happens for as long as the round trip takes.
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="category" className="text-sm text-muted">
        Category
      </label>
      <select
        id="category"
        name="category"
        value={selected ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-busy={pending}
        className="h-10 rounded-md border border-border bg-surface-raised px-3 text-sm text-foreground transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-busy:opacity-60"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name} ({c.productCount})
          </option>
        ))}
      </select>
      {/*
        Fixed-width slot so the label appearing and disappearing cannot move the
        select beside it.
      */}
      <span
        aria-live="polite"
        className={`w-20 text-sm text-muted transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}
      >
        Updating…
      </span>
    </div>
  );
}

/** Same dimensions as the real control, so the row cannot resize on swap. */
export function CategoryFilterSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <span className="text-sm text-muted">Category</span>
      <div className="h-10 w-44 rounded-md border border-border bg-surface" />
    </div>
  );
}
