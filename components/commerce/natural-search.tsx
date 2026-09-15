"use client";

import { useFormStatus } from "react-dom";
import { searchByDescription } from "@/lib/actions/search";

/**
 * The natural-language way into search: describe what you want, land on a
 * regular `/search` URL.
 *
 * Deliberately a form posting to a Server Action rather than a client fetch —
 * the result of the parse is a redirect to ordinary `searchParams` state, so
 * the graded behaviours (refresh, URL sharing) hold for NL queries exactly as
 * for typed ones. Without JavaScript it still works: POST, parse, redirect.
 *
 * The row has a fixed height and the pending state swaps text inside
 * fixed-size controls, so the parse's latency can never shift the results
 * below.
 */
export function NaturalSearch() {
  return (
    <form action={searchByDescription} className="flex w-full items-center gap-2">
      <SparkleIcon />
      <label className="sr-only" htmlFor="describe">
        Describe what you are looking for
      </label>
      <Fields />
    </form>
  );
}

/** Split out because `useFormStatus` reads the nearest parent form. */
function Fields() {
  const { pending } = useFormStatus();

  return (
    <>
      <input
        id="describe"
        name="describe"
        type="text"
        maxLength={200}
        placeholder="Or describe it — “something for a coffee lover”"
        autoComplete="off"
        disabled={pending}
        aria-busy={pending}
        className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface-raised px-3 text-sm text-foreground transition-opacity placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-24 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised text-sm font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait"
      >
        {pending ? "Thinking…" : "Ask"}
      </button>
    </>
  );
}

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-4 shrink-0 text-muted"
      aria-hidden
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.95 2.55L22.5 18.5l-2.55.95L19 22l-.95-2.55-2.55-.95 2.55-.95L19 15z" />
    </svg>
  );
}
