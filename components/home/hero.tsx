import { ButtonLink } from "@/components/ui/button";
import { TriangleMark } from "@/components/brand/triangle-mark";
import { Container } from "@/components/ui/container";

/**
 * The hero is a deliberately black section in both themes — the one surface
 * on the site that does not follow the color scheme. That is what lets the
 * vgpu LED scene (which renders on a black floor) melt into the page with no
 * visible frame, and it is the brand's own contrast: a white triangle on
 * black.
 *
 * The visual is an inline SVG rather than a photograph, and that is a
 * performance decision as much as an aesthetic one: it ships inside the
 * prerendered HTML, costs no network request, and cannot shift layout. On
 * desktop that makes the Largest Contentful Paint the headline text; on
 * narrow viewports the LCP is the first product card image further down,
 * which is why the grid's first row is fetched eagerly with high priority.
 */
export function Hero() {
  return (
    <section className="border-b border-border bg-black text-white">
      <Container size="wide">
        <div className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-start gap-6">
            {/*
              The brief names a visual element as part of the hero, so it is
              present at every viewport — but its composition changes with the
              space. Below `lg` the mark is a compact lockup above the
              headline: the earlier layout put it full-size under the CTA,
              where it stretched the hero to most of a phone screen for a
              shape floating in dead space. The lockup variant hugs the glyph
              so it sits flush with the text's left edge.
            */}
            <TriangleMark variant="lockup" className="w-14 lg:hidden" />
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Gear worth shipping.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-white/70 sm:text-lg">
              Official Vercel apparel, drinkware and desk gear.
            </p>
            <ButtonLink href="/products" size="lg" variant="inverse">
              Shop the collection
            </ButtonLink>
          </div>

          {/*
            The full mark — SVG fallback plus the gated vgpu enhancement
            (components/brand/triangle-mark.tsx, shared with the 404 and
            error pages) — only where the two-column layout gives it a home.
          */}
          <TriangleMark className="hidden lg:block lg:w-full" />
        </div>
      </Container>
    </section>
  );
}

