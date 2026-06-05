import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev activity/build indicator so it never bleeds into a thumbnail
  // capture taken against the dev server.
  devIndicators: false,
};

export default nextConfig;
