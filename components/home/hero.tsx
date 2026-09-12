import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * The hero's visual is an inline SVG rather than a photograph, and that is a
 * performance decision as much as an aesthetic one: it makes the Largest
 * Contentful Paint the headline text, which is already in the prerendered
 * HTML, instead of an image that has to be fetched and decoded first. Nothing
 * above the fold waits on the network, and there is no image box to reserve.
 */
export function Hero() {
  return (
    <section className="border-b border-border bg-surface">
      <Container size="wide">
        <div className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-start gap-6">
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted">
              Official merch
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Gear worth shipping.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-muted sm:text-lg">
              Premium developer apparel, drinkware and desk gear — built to the
              same standard as everything else we ship.
            </p>
            <ButtonLink href="/search" size="lg">
              Shop the collection
            </ButtonLink>
          </div>

          <div className="hidden lg:block" aria-hidden>
            <HeroMark />
          </div>
        </div>
      </Container>
    </section>
  );
}

function HeroMark() {
  return (
    <svg viewBox="0 0 400 300" className="h-auto w-full" role="presentation">
      <defs>
        <linearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <g className="text-foreground">
        <path d="M200 60 320 250H80z" fill="url(#hero-fade)" />
        <path d="M200 110 268 230h-136z" className="fill-surface" />
        <path d="M200 150 236 215h-72z" fill="currentColor" opacity="0.5" />
      </g>
    </svg>
  );
}
