"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleMark } from "@/components/brand/triangle-mark";
import { Button } from "@/components/ui/button";

/**
 * The error boundary for everything under the root layout — an unexpected
 * throw (the commerce API down on an uncached read, a rendering bug) lands
 * here instead of on Next's default screen. Same surface as the 404: black,
 * the shared `TriangleMark`, one primary action.
 *
 * Error boundaries must be Client Components. `TriangleMark` has no
 * server-only dependencies, so importing it from here simply compiles it
 * into the client graph — the gates inside `TriangleCanvas` behave the same.
 *
 * No error details are shown: the message is a stack-adjacent internal
 * string, useless to a shopper and potentially revealing. The digest is
 * logged for correlation with server logs.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary", error.digest ?? "", error);
  }, [error]);

  return (
    <section className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 bg-black px-6 py-20 text-center text-white">
      <TriangleMark className="w-56 sm:w-72" />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Something went wrong
      </h1>
      <p className="max-w-md text-base text-white/70">
        The store hit an unexpected error. Trying again usually resolves it.
      </p>
      <div className="mt-2 flex items-center gap-4">
        <Button type="button" size="lg" variant="inverse" onClick={reset}>
          Try again
        </Button>
        <Link
          href="/"
          className="text-sm font-medium text-white/70 underline underline-offset-4 transition-colors hover:text-white"
        >
          Back to the store
        </Link>
      </div>
    </section>
  );
}
