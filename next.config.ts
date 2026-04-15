import type { NextConfig } from "next";

const basePath = process.env.IS_DEMO === "1" ? "/demo" : "";

const nextConfig: NextConfig = {
  ...(basePath
    ? {
        basePath,
        assetPrefix: "/demo-assets",
        redirects: async () => [
          {
            source: "/",
            destination: basePath,
            permanent: false,
            basePath: false,
          },
        ],
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  devIndicators: false,
  poweredByHeader: false,
  reactCompiler: true,
  logging: {
    fetches: {
      fullUrl: false,
    },
    incomingRequests: false,
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
    ],
  },
  experimental: {
    prefetchInlining: true,
    // cachedNavigations removed: requires cacheComponents, which we don't use (chat is all-dynamic; see design §9.4)
    appNewScrollHandler: true,
    inlineCss: true,
    turbopackFileSystemCacheForDev: true,
  },
  outputFileTracingIncludes: {
    '/api/chat': ['./wiki/wiki/**/*.md', './wiki/wiki/_meta/*.md'],
    '/api/warm': ['./wiki/wiki/_meta/*.md'],
  },
};

export default nextConfig;
