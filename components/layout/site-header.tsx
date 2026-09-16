import { Suspense } from "react";
import Link from "next/link";
import { CartIndicator, CartIndicatorSkeleton } from "@/components/layout/cart-indicator";
import { NavLink } from "@/components/layout/nav-link";
import { Container } from "@/components/ui/container";

/**
 * Persistent header. Everything except the cart count is static and ships in
 * the prerendered shell; the count streams into its reserved slot.
 *
 * The background is deliberately solid rather than translucent with a
 * backdrop-filter. Safari has long-standing repaint bugs with backdrop-filter
 * on sticky elements that show up as a visible flicker or jump while scrolling,
 * and a blur behind a header is not worth a rendering artifact on a storefront.
 *
 * No mobile drawer: there are two navigation links. A hamburger menu here
 * would add a client component, a focus trap and an animation to hide two
 * words that already fit on a 320px screen.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <Container size="wide">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="relative flex items-center gap-2 rounded-md after:absolute after:inset-x-0 after:-inset-y-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Logo />
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              Swag Store
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <nav aria-label="Main" className="flex items-center gap-1">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/search">Search</NavLink>
            </nav>
            <Suspense fallback={<CartIndicatorSkeleton />}>
              <CartIndicator />
            </Suspense>
          </div>
        </div>
      </Container>
    </header>
  );
}

/** Inline so the mark costs no request and cannot shift as it loads. */
function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-foreground" aria-hidden>
      <path d="M12 3 22 20H2z" />
    </svg>
  );
}
