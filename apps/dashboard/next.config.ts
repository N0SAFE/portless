import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dashboard proxies API/SSE calls to the daemon at build/runtime.
  output: "standalone",
};

export default nextConfig;
