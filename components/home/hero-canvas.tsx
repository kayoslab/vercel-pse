"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Progressive enhancement over the hero's SVG mark: the same triangle,
 * rendered live by vgpu (Vercel Labs' WebGPU library) with LED edge lighting
 * that follows the pointer — the "Triangle LED Hero" example from vgpu's
 * verified examples gallery, adapted in `./triangle-led/`.
 *
 * The SVG stays canonical. It is what prerenders into the static shell, what
 * social crawlers and no-JS visitors see, and what every gate below falls
 * back to. This component only ever *adds*: it mounts a canvas over the mark
 * and fades it in once a frame is actually rendering. Nothing about the page
 * changes size, so the enhancement cannot shift layout or touch LCP.
 *
 * The gates, in order:
 * - `navigator.gpu` present — WebGPU is the whole point; no polyfill fallback.
 * - `prefers-reduced-motion: no-preference` — this is continuous animation.
 * - `lg` viewport — on phones the mark renders at 176px, too small to justify
 *   a render loop on battery; the static SVG is the better citizen there.
 * - First idle after hydration — the ~60KB renderer chunk is dynamically
 *   imported and never enters the critical path.
 *
 * While running, the loop pauses when the tab is hidden or the hero scrolls
 * out of view, and the whole renderer is torn down if the viewport drops
 * below `lg`. WebGPU init can still fail after `navigator.gpu` exists (no
 * adapter, blocklisted driver) — that failure is caught and the SVG simply
 * remains.
 */
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!("gpu" in navigator)) return;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;

    const desktop = window.matchMedia("(min-width: 1024px)");

    let renderer: { ready: Promise<unknown>; setPaused(v: boolean): void; dispose(): void } | undefined;
    let cancelled = false;
    let observer: IntersectionObserver | undefined;
    let inView = true;

    const updatePaused = () => renderer?.setPaused(document.hidden || !inView);
    const onVisibilityChange = () => updatePaused();

    const teardown = () => {
      observer?.disconnect();
      observer = undefined;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      renderer?.dispose();
      renderer = undefined;
      setActive(false);
    };

    const start = async () => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled || renderer) return;
      const { createRenderer } = await import("./triangle-led/renderer");
      if (cancelled) return;
      const created = createRenderer({ canvas });
      renderer = created;
      try {
        await created.ready;
      } catch {
        // WebGPU exists but would not initialise. The SVG mark is still there.
        if (renderer === created) renderer = undefined;
        created.dispose();
        return;
      }
      if (cancelled) return;
      observer = new IntersectionObserver(
        ([entry]) => {
          inView = entry?.isIntersecting ?? true;
          updatePaused();
        },
        { threshold: 0 },
      );
      observer.observe(canvas);
      document.addEventListener("visibilitychange", onVisibilityChange);
      setActive(true);
    };

    // Below lg the renderer is torn down, not merely paused — a hidden canvas
    // holding a GPU device is a leak, not an optimisation.
    const onMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) void idle(start);
      else teardown();
    };
    desktop.addEventListener("change", onMediaChange);

    const idle = (fn: () => void): (() => void) => {
      if ("requestIdleCallback" in window) {
        const id = requestIdleCallback(fn, { timeout: 2000 });
        return () => cancelIdleCallback(id);
      }
      const id = setTimeout(fn, 300);
      return () => clearTimeout(id);
    };

    const cancelIdle = desktop.matches ? idle(() => void start()) : undefined;

    return () => {
      cancelled = true;
      cancelIdle?.();
      desktop.removeEventListener("change", onMediaChange);
      teardown();
    };
  }, []);

  return (
    /*
      Absolutely positioned inside the mark's container, so its presence can
      never change the hero's layout. The dark panel look is deliberate — the
      scene renders LED light on a black floor, and framing it as a screen
      reads as intentional in both colour schemes.
    */
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden rounded-2xl bg-black transition-opacity duration-700 ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  );
}
