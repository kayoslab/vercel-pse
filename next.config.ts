import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: data is excluded from prerenders unless explicitly
  // cached with `use cache`. Unifies the former ppr/useCache/dynamicIO flags.
  cacheComponents: true,

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
