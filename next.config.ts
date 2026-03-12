import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jsdom", "puppeteer", "imapflow", "mailparser"],
};

export default nextConfig;
