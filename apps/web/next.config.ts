import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@jamot/archetype-engine", "@jamot/client"],
};

export default nextConfig;
