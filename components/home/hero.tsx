import { ButtonLink } from "@/components/ui/button";
import { HeroCanvas } from "@/components/home/hero-canvas";
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
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              Official merch
            </span>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Gear worth shipping.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-white/70 sm:text-lg">
              Premium developer apparel, drinkware and desk gear — built to the
              same standard as everything else we ship.
            </p>
            <ButtonLink href="/products" size="lg" variant="inverse">
              Shop the collection
            </ButtonLink>
          </div>

          {/*
            The brief names a visual element as part of the hero, so it is
            present at every viewport — scaled down on small screens rather
            than hidden. Being inline SVG it costs nothing to keep.

            On desktops with WebGPU, `HeroCanvas` fades a live vgpu-rendered
            version of the same mark in over the SVG — see hero-canvas.tsx for
            the gates. The wrapper is `relative` and the canvas absolute, so
            the enhancement occupies exactly the SVG's box and cannot shift
            layout. `aspect-[4/3]` pins that box: the SVG's own 400×300
            viewBox already implies it, but the canvas needs it stated.
          */}
          <div
            className="relative mx-auto aspect-[4/3] w-44 sm:w-60 lg:mx-0 lg:w-full"
            aria-hidden
          >
            <HeroMark />
            <HeroCanvas />
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * A plain white triangle on the hero's black ground — the brand mark at its
 * most reduced.
 *
 * The geometry deliberately matches the vgpu scene's canonical triangle
 * (height = 40% of the box, centroid-centred: see TRIANGLE_HEIGHT_RATIO in
 * triangle-led/settings.ts), so when the canvas fades in over this SVG the
 * lit triangle appears exactly where the white one was — a power-on moment,
 * not a jump. Change the two together.
 */
function HeroMark() {
  return (
    <svg viewBox="0 0 400 300" className="h-auto w-full" role="presentation">
      <path d="M200 70 269.3 190H130.7z" fill="#ffffff" />
    </svg>
  );
}
