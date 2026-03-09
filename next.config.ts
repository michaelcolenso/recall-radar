import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
  logging: { fetches: { fullUrl: true } },
};

export default nextConfig;
