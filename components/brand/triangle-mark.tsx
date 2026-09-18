import { TriangleCanvas } from "@/components/brand/triangle-canvas";

/**
 * The brand mark: a white triangle on black, upgrading itself to the live
 * vgpu LED rendering on capable desktops. Shared by the hero, the 404 page
 * and the error page so the surfaces cannot drift — same geometry, same
 * gates, same fallback. The path itself is the single source of truth for
 * both variants.
 *
 * Requires a black surface behind it: the SVG is white and the canvas paints
 * a black floor, so on anything lighter the enhancement would appear as a
 * visible rectangle. Callers own sizing via `className`.
 *
 * Two variants:
 *
 * - `scene` (default): the canvas-matched framing — a 4:3 box in which the
 *   triangle's height is 40% and centroid-centred, exactly the vgpu scene's
 *   canonical triangle (TRIANGLE_HEIGHT_RATIO in triangle-led/settings.ts),
 *   so the canvas fade-in lights the mark up in place. Change the two
 *   together.
 * - `lockup`: the same path in a viewBox that hugs the glyph, for compact
 *   inline use (the mobile hero, above the headline). The scene framing
 *   there would inset the glyph a third of its box and float it in dead
 *   space; a lockup must sit flush with the text it labels. Never enhanced —
 *   there is no scene to light up.
 */
const TRIANGLE_PATH = "M200 70 269.3 190H130.7z";

export function TriangleMark({
  className,
  variant = "scene",
}: {
  className?: string;
  variant?: "scene" | "lockup";
}) {
  if (variant === "lockup") {
    return (
      <svg
        viewBox="130.7 70 138.6 120"
        className={`h-auto ${className ?? ""}`}
        aria-hidden
        role="presentation"
      >
        <path d={TRIANGLE_PATH} fill="#ffffff" />
      </svg>
    );
  }

  return (
    <div className={`relative aspect-[4/3] ${className ?? ""}`} aria-hidden>
      <svg viewBox="0 0 400 300" className="h-auto w-full" role="presentation">
        <path d={TRIANGLE_PATH} fill="#ffffff" />
      </svg>
      <TriangleCanvas />
    </div>
  );
}
