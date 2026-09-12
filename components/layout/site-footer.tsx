import { Container } from "@/components/ui/container";

/**
 * Synchronous on purpose.
 *
 * The year comes from `BUILD_YEAR`, inlined by `next.config.ts` at build time.
 * The obvious alternative — `new Date()` in the component — is rejected by
 * Cache Components as non-deterministic, and the fix for *that* (wrapping the
 * footer in `use cache`) makes the component async. An async component in the
 * root layout is a streaming hole: it is present in the prerendered shell, but
 * on a client-side navigation it resolves after the page content and visibly
 * shifts the layout. Measured at 0.047 CLS when filtering the catalogue.
 *
 * A synchronous footer renders with the rest of the layout every time. The year
 * rolls over on the first deploy of a new year, which is how essentially every
 * site handles it.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container size="wide">
        <div className="flex flex-col items-center justify-between gap-2 py-8 text-xs text-muted sm:flex-row sm:text-sm">
          <p>© {process.env.BUILD_YEAR} Vercel Swag Store. All rights reserved.</p>
          <p>Built with Next.js on Vercel.</p>
        </div>
      </Container>
    </footer>
  );
}
