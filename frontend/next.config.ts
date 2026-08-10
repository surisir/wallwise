import type { NextConfig } from "next";
// Standard Node output keeps local Windows builds independent of symlink support.
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: "http://127.0.0.1:4000/:path*",
      },
    ];
  },
};
export default nextConfig;
