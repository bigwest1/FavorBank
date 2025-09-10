import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow production builds to succeed even if there are ESLint or TS issues.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // This bypasses type-checking during build; recommended only when you have
    // a separate type-check step in CI or are iterating quickly.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
