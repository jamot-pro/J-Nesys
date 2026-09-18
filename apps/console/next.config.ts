import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@jamot/archetype-engine", "@jamot/client", "@jamot/canvas-lead-generation"],
};

export default nextConfig;
