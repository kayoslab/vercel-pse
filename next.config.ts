import type { NextConfig } from "next";
import createWithVercelToolbar from "@vercel/toolbar/plugins/next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  env: {
    /*
     * Resolved once when the build starts and inlined as a literal. This keeps
     * the footer a synchronous component: `new Date()` inside a React render is
     * rejected by Cache Components as non-deterministic, and wrapping the footer
     * in `use cache` to satisfy that made it an async component — which turned it
     * into a streaming hole that arrived late on client-side navigation and
     * shifted the page. A build-time constant avoids the whole problem.
     */
    BUILD_YEAR: String(new Date().getFullYear()),
  },

  // Cache Components: data is excluded from prerenders unless explicitly
  // cached with `use cache`. Unifies the former ppr/useCache/dynamicIO flags.
  cacheComponents: true,

  // vgpu example shaders are authored as .wgsl modules; the loader turns each
  // into a JS string export (with WGSL imports resolved) at build time.
  turbopack: {
    rules: {
      "*.wgsl": {
        loaders: ["@vgpu/wgsl/loader-webpack"],
        as: "*.js",
      },
    },
  },

  images: {
    // AVIF first, WebP fallback: ~20-30% smaller for these flat product
    // shots, negotiated per Accept header. The optimizer caches each
    // transcode, so the AVIF encode cost is paid once per variant.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i8qy5y6gxkdgdcv9.public.blob.vercel-storage.com",
        pathname: "/storefront/**",
      },
    ],
  },
};

/*
 * withEve mounts the store agent (the `agent/` directory) at /eve/v1/* —
 * one dev command, one Vercel project, with the agent running as its own
 * service beside the Next.js app. The storefront's rendering model is
 * untouched: the agent is additive routing, not a rendering change.
 *
 * The toolbar plugin wires the local-dev Vercel Toolbar (Flags Explorer
 * overrides); on Vercel deployments the toolbar is injected by the platform.
 * Order matters: the toolbar wraps the plain config; withEve wraps last,
 * because it returns Next's function-form config to orchestrate the agent
 * service alongside the app.
 */
export default withEve(createWithVercelToolbar()(nextConfig));
