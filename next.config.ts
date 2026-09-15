import type { NextConfig } from "next";

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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i8qy5y6gxkdgdcv9.public.blob.vercel-storage.com",
        pathname: "/storefront/**",
      },
    ],
  },
};

export default nextConfig;
