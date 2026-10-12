// =============================================================================
// next.config.ts — dashboard build settings
// =============================================================================
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The build is a type gate: a type error fails the deploy rather than
  // shipping. Ennyn learned this one the hard way.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
