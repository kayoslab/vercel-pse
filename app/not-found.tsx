import type { Metadata } from "next";
import { TriangleMark } from "@/components/brand/triangle-mark";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * The 404 — reached by any unknown URL and by `notFound()` on the product
 * page when a slug does not resolve. Styled like the hero: the same black
 * surface and the same `TriangleMark`, so even the dead end carries the
 * brand — and on a capable desktop the LED scene runs here too, which makes
 * a mistyped URL the most unexpectedly polished page in the store.
 *
 * Fully static: no data, no request state, prerendered into the shell.
 */
export default function NotFound() {
  return (
    <section className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 bg-black px-6 py-20 text-center text-white">
      <TriangleMark className="w-56 sm:w-72" />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Page not found
      </h1>
      <p className="max-w-md text-base text-white/70">
        Nothing ships from this URL.
      </p>
      <ButtonLink href="/" size="lg" variant="inverse" className="mt-2">
        Back to the store
      </ButtonLink>
    </section>
  );
}
