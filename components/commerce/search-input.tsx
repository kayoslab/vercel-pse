"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, buttonStyles } from "@/components/ui/button";

/** The brief's threshold: typing alone searches once at least this many characters. */
const AUTO_SEARCH_MIN_LENGTH = 3;

/** Long enough to not fire mid-word, short enough to feel immediate. */
const DEBOUNCE_MS = 300;

/**
 * The search box.
 *
 * Three ways to search, as specified: pressing Enter, clicking the button, or
 * simply typing at least three characters. Explicit triggers bypass the length
 * rule — someone who types "DX" and presses Enter meant to search for it.
 *
 * This component is deliberately *outside* the Suspense boundary that wraps the
 * results. If it sat inside, every debounced search would re-suspend the
 * boundary, remount the input and take the caret with it — which makes typing
 * impossible. Keeping it in the static shell also means it is interactive before
 * the first results arrive.
 */
export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);

  // Keep the field in step with the URL when navigation comes from elsewhere —
  // the back button, or a shared link. Comparing against the URL value rather
  // than syncing unconditionally avoids clobbering what the user is typing.
  const lastUrlQuery = useRef(urlQuery);
  useEffect(() => {
    if (urlQuery !== lastUrlQuery.current) {
      lastUrlQuery.current = urlQuery;
      setValue(urlQuery);
    }
  }, [urlQuery]);

  const search = (term: string) => {
    const params = new URLSearchParams(searchParams);
    const trimmed = term.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    // A new search starts at the beginning of the results.
    params.delete("page");

    const qs = params.toString();
    lastUrlQuery.current = trimmed;
    startTransition(() => {
      router.push(qs ? `/search?${qs}` : "/search");
    });
  };

  // Debounced auto-search. Clearing the field navigates back to the default
  // product set immediately rather than leaving stale results on screen.
  useEffect(() => {
    if (value === urlQuery) return;
    if (value.trim().length > 0 && value.trim().length < AUTO_SEARCH_MIN_LENGTH) return;

    const timer = setTimeout(() => search(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `search` closes over searchParams, which changes on every navigation;
    // depending on it would re-arm the timer in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, urlQuery]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        search(value);
      }}
      className="flex w-full items-center gap-2"
    >
      <label className="sr-only" htmlFor="q">
        Search products
      </label>
      <input
        id="q"
        name="q"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search products…"
        autoComplete="off"
        aria-busy={pending}
        className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface-raised px-3 text-sm text-foreground transition-opacity placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-busy:opacity-60"
      />
      <Button type="submit" variant="secondary" className="shrink-0">
        Search
      </Button>
      {/*
        Explicit loading feedback, in a fixed-width slot so its appearance cannot
        resize the input beside it.

        React keeps the previous results on screen during a transition rather
        than blanking them, which is the better experience — no flash of empty
        state between two populated ones. But it also means nothing visibly
        changes while a search is in flight, so the acknowledgement has to be
        stated rather than implied. The alternative, forcing the results boundary
        to re-suspend and show a skeleton, would replace real content with grey
        boxes on every keystroke.
      */}
      <span
        aria-live="polite"
        className={`w-20 shrink-0 text-sm text-muted transition-opacity ${
          pending ? "opacity-100" : "opacity-0"
        }`}
      >
        Searching…
      </span>
    </form>
  );
}

/**
 * Reserves the search row. `useSearchParams` is uncached request data, so this
 * Client Component still needs a Suspense boundary for the prerender — and the
 * fallback has to match the real control's height or the results below it move.
 */
export function SearchInputSkeleton() {
  return (
    <div className="flex w-full items-center gap-2" aria-hidden>
      <div className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface" />
      <div className={buttonStyles({ variant: "secondary", className: "shrink-0 opacity-50" })}>
        Search
      </div>
      <span className="w-20 shrink-0" />
    </div>
  );
}
