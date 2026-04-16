import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  experimental: {
    devtoolSegmentExplorer: false
  }
};

export default nextConfig;
