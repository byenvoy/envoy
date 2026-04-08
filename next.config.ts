import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["jsdom", "puppeteer", "imapflow", "mailparser"],
};

export default nextConfig;
