import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server for cPanel's Node.js App (see docs/CPANEL.md).
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // No next/image use; also keeps the platform-specific sharp binary out.
  images: { unoptimized: true },
  async rewrites() {
    const target = (
      process.env.API_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:4000"
    ).replace(/\/$/, "");
    return [
      { source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` },
      { source: "/api/docs", destination: `${target}/api/docs` },
      { source: "/api/docs/:path*", destination: `${target}/api/docs/:path*` },
    ];
  },
};

export default nextConfig;
