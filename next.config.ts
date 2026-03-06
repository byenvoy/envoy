import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jsdom", "puppeteer"],
};

export default nextConfig;
