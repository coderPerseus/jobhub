import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@folk-job/contracts"],
};

export default nextConfig;

initOpenNextCloudflareForDev();

