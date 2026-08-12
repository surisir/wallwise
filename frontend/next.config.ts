import type { NextConfig } from "next";
// Standard Node output keeps local Windows builds independent of symlink support.
const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};
export default nextConfig;
