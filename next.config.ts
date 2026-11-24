import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  experimental: {
    devtoolSegmentExplorer: false
  }
};

export default nextConfig;
