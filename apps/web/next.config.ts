import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const target = (
      process.env.API_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:4000"
    ).replace(/\/$/, "");
    return [
      { source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` },
    ];
  },
};

export default nextConfig;
