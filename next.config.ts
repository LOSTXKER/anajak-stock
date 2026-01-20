import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent redirect issues with webhooks
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
