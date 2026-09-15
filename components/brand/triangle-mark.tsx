import { TriangleCanvas } from "@/components/brand/triangle-canvas";

/**
 * The brand mark: a white triangle on black, upgrading itself to the live
 * vgpu LED rendering on capable desktops. Shared by the hero, the 404 page
 * and the error page so the three cannot drift — same geometry, same gates,
 * same fallback.
 *
 * Requires a black surface behind it: the SVG is white and the canvas paints
 * a black floor, so on anything lighter the enhancement would appear as a
 * visible rectangle. Callers own sizing via `className`; the aspect ratio is
 * pinned here because the canvas needs the box stated even before the SVG
 * loads.
 *
 * The triangle's geometry matches the vgpu scene's canonical triangle
 * (height = 40% of the box, centroid-centred — TRIANGLE_HEIGHT_RATIO in
 * triangle-led/settings.ts), so the canvas fade-in lights the mark up in
 * place. Change the two together.
 */
export function TriangleMark({ className }: { className?: string }) {
  return (
    <div className={`relative aspect-[4/3] ${className ?? ""}`} aria-hidden>
      <svg viewBox="0 0 400 300" className="h-auto w-full" role="presentation">
        <path d="M200 70 269.3 190H130.7z" fill="#ffffff" />
      </svg>
      <TriangleCanvas />
    </div>
  );
}
